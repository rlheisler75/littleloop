-- 24-hour daycares (Robert, 2026-11-26: "might have some 24 hour daycares so need to account for that").
--   * An evening snack, for evening and overnight care (6 meal services).
--   * daycare_kitchen_settings.weekends: menus run Monday to Sunday.
--   * Who was "here" on a day = anyone checked in at any point that day, including children
--     still checked in from the night before. Meal counts and the food program report used
--     "checked in that day", which flagged an overnight child's breakfast as "not checked in".
--     A check-in nobody closed counts for at most 48 hours, so a forgotten check-out can't
--     inflate attendance.

-- ── Evening snack ───────────────────────────────────────────────────────────────
alter table public.care_logs drop constraint care_logs_check;
alter table public.care_logs add constraint care_logs_meal_check
  check (meal is null or (kind = 'meal' and meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper', 'evening_snack')));
alter table public.daycare_kitchen_settings drop constraint daycare_kitchen_settings_meals_check;
alter table public.daycare_kitchen_settings add constraint daycare_kitchen_settings_meals_check
  check (cardinality(meals) between 1 and 6 and meals <@ array['breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper', 'evening_snack']);
alter table public.daycare_menus drop constraint daycare_menus_meal_check;
alter table public.daycare_menus add constraint daycare_menus_meal_check
  check (meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper', 'evening_snack'));
alter table public.daycare_meal_subs drop constraint daycare_meal_subs_meal_check;
alter table public.daycare_meal_subs add constraint daycare_meal_subs_meal_check
  check (meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper', 'evening_snack'));

-- ── Open on weekends ────────────────────────────────────────────────────────────
alter table public.daycare_kitchen_settings add column weekends boolean not null default false;

-- ── Who was here each day (internal: called only by the functions below) ──────────
create or replace function public.daycare_presence(p_facility uuid, p_from date, p_to date)
returns table (day date, child_id uuid) language sql stable security definer set search_path = public as $$
  with ev as (
    select ci.child_id, ci.status::text as status, ci.checked_at,
           lead(ci.checked_at) over (partition by ci.child_id order by ci.checked_at) as next_at
      from checkins ci
     where ci.facility_id = p_facility
       and ci.checked_at <  ((p_to + 1)::timestamp at time zone 'America/Chicago')
       and ci.checked_at >= (p_from::timestamp at time zone 'America/Chicago') - interval '48 hours'
  ), stays as (
    select child_id, checked_at as s,
           least(coalesce(next_at, checked_at + interval '48 hours'), checked_at + interval '48 hours') as e
      from ev where status = 'in'
  )
  select distinct d::date, st.child_id
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
    join stays st on st.s < ((d::date + 1)::timestamp at time zone 'America/Chicago')
                 and st.e >  (d::date::timestamp at time zone 'America/Chicago')
$$;
revoke execute on function public.daycare_presence(uuid, date, date) from public, anon, authenticated;

create or replace function public.daycare_meal_counts(p_facility uuid, p_day date)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_kitchen_staff(p_facility) or is_admin()) then
    raise exception 'Only the daycare''s kitchen and classroom staff can see meal counts.' using errcode = '42501';
  end if;
  return json_build_object(
    'checked_in', (   -- here at any time that day (overnight stays included)
      select coalesce(json_agg(json_build_object('classroom_id', room, 'n', n)), '[]'::json) from (
        select e.classroom_id as room, count(distinct p.child_id)::int as n
          from daycare_presence(p_facility, p_day, p_day) p
          join facility_enrollments e on e.child_id = p.child_id and e.facility_id = p_facility and e.status = 'active'
         group by 1) x),
    'served', (
      select coalesce(json_agg(json_build_object('meal', meal, 'classroom_id', room, 'n', n)), '[]'::json) from (
        select l.meal, e.classroom_id as room, count(distinct l.child_id)::int as n
          from care_logs l
          left join facility_enrollments e on e.child_id = l.child_id and e.facility_id = p_facility and e.status = 'active'
         where l.facility_id = p_facility and l.day = p_day and l.kind = 'meal'
         group by 1, 2) y)
  );
end $$;

create or replace function public.daycare_cacfp_month(p_facility uuid, p_month date)
returns json language plpgsql stable security definer set search_path = public as $$
declare v_from date := date_trunc('month', p_month)::date;
        v_to   date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see the food program report.' using errcode = '42501';
  end if;
  return (
    with logs as (
      select l.day, l.child_id, l.meal from care_logs l
       where l.facility_id = p_facility and l.kind = 'meal' and l.meal is not null and l.day between v_from and v_to
       group by 1, 2, 3
    ), att as (
      select day, child_id from daycare_presence(p_facility, v_from, v_to)
    ), cat as (
      select child_id, category from daycare_cacfp_children where facility_id = p_facility
    ), per_child as (
      select day, child_id,
             count(*) filter (where meal in ('breakfast', 'lunch', 'supper'))::int as meals,
             count(*) filter (where meal in ('am_snack', 'pm_snack', 'evening_snack'))::int as snacks,
             array_agg(meal order by array_position(array['breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper', 'evening_snack'], meal)) as which
        from logs group by 1, 2
    )
    select json_build_object(
      'from', v_from, 'to', v_to,
      'counts', (select coalesce(json_agg(x order by x.day, x.meal), '[]'::json) from (
          select l.day, l.meal, coalesce(c.category, 'unset') as category, count(*)::int as n
            from logs l left join cat c on c.child_id = l.child_id group by 1, 2, 3) x),
      'attendance', (select coalesce(json_agg(a order by a.day), '[]'::json) from (
          select day, count(*)::int as n from att group by 1) a),
      'over_limit', (select coalesce(json_agg(json_build_object('day', p.day, 'child_id', p.child_id, 'name', ch.name, 'meals', p.which) order by p.day, ch.name), '[]'::json)
          from per_child p join children ch on ch.id = p.child_id
         where p.meals > 2 or p.snacks > 2 or p.meals + p.snacks > 3),
      'not_checked_in', (select coalesce(json_agg(json_build_object('day', l.day, 'child_id', l.child_id, 'name', ch.name, 'meal', l.meal) order by l.day, ch.name), '[]'::json)
          from logs l join children ch on ch.id = l.child_id
         where not exists (select 1 from att a where a.day = l.day and a.child_id = l.child_id)),
      'untagged', (select count(*)::int from care_logs l
         where l.facility_id = p_facility and l.kind = 'meal' and l.meal is null and l.day between v_from and v_to)
    )
  );
end $$;
