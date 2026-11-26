-- Daycare phase 5A: the kitchen.
--   New staff roles: cook and housekeeper. They are on staff (time clock, staff list, the daycare's
--   name and rooms) but are NOT childcare staff: they can't see children's records, families,
--   check-ins, daily reports, photos or documents. A cook sees only what the kitchen needs about
--   each enrolled child (name, room, allergies and diet) through daycare_kitchen_children().
--   is_facility_staff() now means childcare staff (director, office, teacher), so every existing
--   rule built on it stays closed to the new roles; is_facility_member() is anyone on staff.
--
--   daycare_kitchen_settings : meals the daycare serves; whether it's in the USDA food program (CACFP)
--   daycare_foods            : the kitchen's food list (food group + the 9 major allergens), reused when planning
--   daycare_menus            : what's served at each meal on each day (foods copied in, so later edits to
--                              the food list don't rewrite old menus)
--   daycare_menu_weeks       : a week is shared with families when the kitchen says so
--   daycare_meal_subs        : the substitute a child with an allergy or diet gets at a meal (the child's
--                              parents can read their own child's)
--   care_logs.meal           : which meal a "Meal" entry was, for meal counts
--   daycare_cacfp_children   : free / reduced / paid for the food program (office only: it's income-based)
--   daycare_food_orders      : orders to vendors; the office can turn a received order into a Food expense
--   daycare_temp_units/logs  : fridge and freezer temperature log
-- Who: the kitchen (director, office, teacher, cook) plans menus, orders and temperatures.
-- The food program report and the free/reduced/paid categories are for the director and office.

-- ── Roles ───────────────────────────────────────────────────────────────────────
alter table public.facility_staff drop constraint facility_staff_role_check;
alter table public.facility_staff add constraint facility_staff_role_check
  check (role in ('director', 'office', 'teacher', 'cook', 'housekeeper'));

-- Childcare staff only (was: anyone on staff)
create or replace function public.is_facility_staff(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(facility_role(p_facility_id) in ('director', 'office', 'teacher'), false)
$$;
-- Anyone on staff, including the cook and housekeeper
create or replace function public.is_facility_member(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select facility_role(p_facility_id) is not null
$$;
-- Who works in the kitchen screens
create or replace function public.is_kitchen_staff(p_facility_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(facility_role(p_facility_id) in ('director', 'office', 'teacher', 'cook'), false)
$$;

-- Helpers that looked up facility_staff directly now also require a childcare role.
-- (Edited in place so nothing else in these functions changes; each pattern must match exactly.)
do $$
declare r record; v_def text; v_n int;
begin
  for r in select * from (values
    ('public.can_staff_see_child_docs(uuid,uuid)',      's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.is_facility_staff_for_family(uuid,uuid)',  's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.is_family_facility_requested(uuid)',       's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.is_family_facility_staff(uuid)',           's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.is_room_teacher(uuid)',                    's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.post_to_children(uuid[],post_type,post_mood,text,text)', 's.user_id = auth.uid() and s.status = ''active''', ' and s.role in (''director'', ''office'', ''teacher'')', 3),
    ('public.user_family_ids(uuid)',                    's.user_id = p_user and s.status = ''active''',     ' and s.role in (''director'', ''office'', ''teacher'')', 1),
    ('public.start_room_shift(uuid,uuid)',              'facility_id = v_fac and user_id = auth.uid() and status = ''active''', ' and role in (''director'', ''office'', ''teacher'')', 1),
    ('public.start_room_shift(uuid,uuid)',              'id = p_staff_id and facility_id = v_fac and status = ''active''',     ' and role in (''director'', ''office'', ''teacher'')', 1),
    ('public.facility_plan_summary(uuid)',              'is_facility_staff(p_facility_id) or is_admin()', '', 1)
  ) as t(fn, pat, suffix, expect) loop
    v_def := pg_get_functiondef(r.fn::regprocedure);
    if r.suffix <> '' and position(r.pat || r.suffix in v_def) > 0 then continue; end if;   -- already done
    v_n := (length(v_def) - length(replace(v_def, r.pat, ''))) / length(r.pat);
    if v_n <> r.expect then raise exception '% has % match(es) of [%], expected %', r.fn, v_n, r.pat, r.expect; end if;
    if r.suffix = '' then   -- the plan summary: anyone on staff (so a cook also sees when the trial is over)
      execute replace(v_def, r.pat, 'is_facility_member(p_facility_id) or is_admin()');
    else
      execute replace(v_def, r.pat, r.pat || r.suffix);
    end if;
  end loop;
end $$;

-- What anyone on staff may read: the daycare itself, the staff list, the rooms, the clock settings
alter policy "facilities: staff and families read" on public.facilities
  using (is_facility_member(id) or is_facility_family_member(id) or is_admin());
alter policy "facility_staff: staff read" on public.facility_staff
  using (is_facility_member(facility_id) or user_id = auth.uid() or is_admin());
alter policy "classrooms: staff and families read" on public.classrooms
  using (is_facility_member(facility_id) or is_facility_family_member(facility_id) or is_admin());
alter policy "daycare_timeclock_settings: staff read" on public.daycare_timeclock_settings
  using (is_facility_member(facility_id) or is_admin());

-- ── Shared bits ─────────────────────────────────────────────────────────────────
create or replace function public.daycare_week_start(p_day date)
returns date language sql immutable as $$ select p_day - (extract(isodow from p_day)::int - 1) $$;

create or replace function public.daycare_valid_foods(p jsonb)
returns boolean language plpgsql immutable as $$
declare f jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 15 then return false; end if;
  for f in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(f) <> 'object' then return false; end if;
    if coalesce(char_length(btrim(f->>'name')), 0) not between 1 and 80 then return false; end if;
    if coalesce(f->>'component', 'other') not in ('milk', 'fruit', 'vegetable', 'grain', 'protein', 'other') then return false; end if;
    if f ? 'allergens' then
      if jsonb_typeof(f->'allergens') <> 'array' then return false; end if;
      if exists (select 1 from jsonb_array_elements(f->'allergens') a
                  where jsonb_typeof(a) <> 'string'
                     or a #>> '{}' not in ('milk', 'egg', 'peanut', 'tree_nut', 'fish', 'shellfish', 'wheat', 'soy', 'sesame')) then
        return false;
      end if;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.daycare_valid_order_items(p jsonb)
returns boolean language plpgsql immutable as $$
declare f jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 100 then return false; end if;
  for f in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(f) <> 'object' then return false; end if;
    if coalesce(char_length(btrim(f->>'name')), 0) not between 1 and 80 then return false; end if;
    if char_length(coalesce(f->>'qty', '')) > 30 then return false; end if;
    if f ? 'done' and jsonb_typeof(f->'done') <> 'boolean' then return false; end if;
  end loop;
  return true;
end $$;

-- Who changed it last (the staff member's name, kept on the row)
create or replace function public.daycare_kitchen_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then new.facility_id := old.facility_id; end if;
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by_name := coalesce(facility_staff_name(new.facility_id), new.updated_by_name); end if;
  return new;
end $$;

-- ── Settings ────────────────────────────────────────────────────────────────────
create table public.daycare_kitchen_settings (
  facility_id uuid primary key references public.facilities(id) on delete cascade,
  meals       text[] not null default '{breakfast,am_snack,lunch,pm_snack}'
              check (cardinality(meals) between 1 and 5 and meals <@ array['breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper']),
  cacfp       boolean not null default false,
  updated_by_name text,
  updated_at  timestamptz not null default now()
);
alter table public.daycare_kitchen_settings enable row level security;
create policy "daycare_kitchen_settings: staff read" on public.daycare_kitchen_settings for select
  using (is_facility_member(facility_id) or is_admin());
create policy "daycare_kitchen_settings: managers write" on public.daycare_kitchen_settings for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());
create trigger daycare_kitchen_settings_stamp before insert or update on public.daycare_kitchen_settings
  for each row execute function public.daycare_kitchen_stamp();

-- ── Food list ───────────────────────────────────────────────────────────────────
create table public.daycare_foods (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  name_key    text generated always as (lower(btrim(name))) stored,
  component   text not null default 'other' check (component in ('milk', 'fruit', 'vegetable', 'grain', 'protein', 'other')),
  allergens   text[] not null default '{}'
              check (allergens <@ array['milk', 'egg', 'peanut', 'tree_nut', 'fish', 'shellfish', 'wheat', 'soy', 'sesame']),
  updated_by_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (facility_id, name_key)
);
alter table public.daycare_foods enable row level security;
create policy "daycare_foods: kitchen" on public.daycare_foods for all
  using (is_kitchen_staff(facility_id) or is_admin()) with check (is_kitchen_staff(facility_id) or is_admin());
create trigger daycare_foods_stamp before insert or update on public.daycare_foods
  for each row execute function public.daycare_kitchen_stamp();

-- ── Menus ───────────────────────────────────────────────────────────────────────
create table public.daycare_menu_weeks (
  facility_id    uuid not null references public.facilities(id) on delete cascade,
  week_start     date not null check (extract(isodow from week_start) = 1),
  shared_at      timestamptz,
  shared_by_name text,
  updated_by_name text,
  updated_at     timestamptz not null default now(),
  primary key (facility_id, week_start)
);
alter table public.daycare_menu_weeks enable row level security;
create policy "daycare_menu_weeks: kitchen" on public.daycare_menu_weeks for all
  using (is_kitchen_staff(facility_id) or is_admin()) with check (is_kitchen_staff(facility_id) or is_admin());
create policy "daycare_menu_weeks: families read shared" on public.daycare_menu_weeks for select
  using (shared_at is not null and is_facility_family_member(facility_id));
-- Sharing is stamped with the time and who did it; sharing again keeps the first stamp
create or replace function public.daycare_menu_weeks_share()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.shared_at is null then
    new.shared_by_name := null;
  elsif tg_op = 'UPDATE' and old.shared_at is not null then
    new.shared_at := old.shared_at; new.shared_by_name := old.shared_by_name;
  else
    new.shared_at := now(); new.shared_by_name := facility_staff_name(new.facility_id);
  end if;
  return new;
end $$;
create trigger daycare_menu_weeks_stamp before insert or update on public.daycare_menu_weeks
  for each row execute function public.daycare_kitchen_stamp();
create trigger daycare_menu_weeks_share before insert or update on public.daycare_menu_weeks
  for each row execute function public.daycare_menu_weeks_share();

create table public.daycare_menus (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  day         date not null,
  meal        text not null check (meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper')),
  foods       jsonb not null default '[]' check (daycare_valid_foods(foods)),
  note        text check (char_length(note) <= 300),
  updated_by_name text,
  updated_at  timestamptz not null default now(),
  unique (facility_id, day, meal)
);
alter table public.daycare_menus enable row level security;
create policy "daycare_menus: kitchen" on public.daycare_menus for all
  using (is_kitchen_staff(facility_id) or is_admin()) with check (is_kitchen_staff(facility_id) or is_admin());
create policy "daycare_menus: families read shared weeks" on public.daycare_menus for select
  using (is_facility_family_member(facility_id) and exists (
    select 1 from daycare_menu_weeks w where w.facility_id = daycare_menus.facility_id
       and w.week_start = daycare_week_start(daycare_menus.day) and w.shared_at is not null));
create trigger daycare_menus_stamp before insert or update on public.daycare_menus
  for each row execute function public.daycare_kitchen_stamp();

create table public.daycare_meal_subs (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  day         date not null,
  meal        text not null check (meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper')),
  child_id    uuid not null references public.children(id) on delete cascade,
  substitute  text not null check (char_length(btrim(substitute)) between 1 and 200),
  updated_by_name text,
  updated_at  timestamptz not null default now(),
  unique (facility_id, day, meal, child_id)
);
alter table public.daycare_meal_subs enable row level security;
create policy "daycare_meal_subs: kitchen read" on public.daycare_meal_subs for select
  using (is_kitchen_staff(facility_id) or is_admin());
create policy "daycare_meal_subs: kitchen add" on public.daycare_meal_subs for insert
  with check (is_kitchen_staff(facility_id) and facility_has_child(facility_id, child_id));
create policy "daycare_meal_subs: kitchen change" on public.daycare_meal_subs for update
  using (is_kitchen_staff(facility_id)) with check (is_kitchen_staff(facility_id) and facility_has_child(facility_id, child_id));
create policy "daycare_meal_subs: kitchen remove" on public.daycare_meal_subs for delete
  using (is_kitchen_staff(facility_id));
create policy "daycare_meal_subs: parents read own child" on public.daycare_meal_subs for select
  using (is_child_parent(child_id));
create trigger daycare_meal_subs_stamp before insert or update on public.daycare_meal_subs
  for each row execute function public.daycare_kitchen_stamp();

-- What the kitchen may know about the enrolled children: name, room, allergies and diet. Nothing else.
create or replace function public.daycare_kitchen_children(p_facility uuid)
returns table (child_id uuid, name text, preferred_name text, classroom_id uuid, classroom_name text, dob date,
               allergies text[], allergy_severe boolean, allergy_reaction text, diet_types text[],
               dietary_restrictions text, feeding_notes text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_kitchen_staff(p_facility) or is_admin()) then
    raise exception 'Only the daycare''s kitchen and classroom staff can see this.' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, nullif(btrim(c.preferred_name), ''), e.classroom_id, r.name, c.dob::date,
           coalesce(c.allergies, '{}'), coalesce(c.allergy_severe, false), c.allergy_reaction,
           coalesce(c.diet_types, '{}'), c.dietary_restrictions, c.feeding_notes
      from facility_enrollments e
      join children c on c.id = e.child_id
      left join classrooms r on r.id = e.classroom_id
     where e.facility_id = p_facility and e.status = 'active'
     order by c.name;
end $$;

-- ── Meal counts ─────────────────────────────────────────────────────────────────
alter table public.care_logs add column meal text
  check (meal is null or (kind = 'meal' and meal in ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper')));
create index care_logs_meal_counts on public.care_logs (facility_id, day) where kind = 'meal';

-- One day for the kitchen: children checked in per room, and meals logged per meal per room
create or replace function public.daycare_meal_counts(p_facility uuid, p_day date)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_kitchen_staff(p_facility) or is_admin()) then
    raise exception 'Only the daycare''s kitchen and classroom staff can see meal counts.' using errcode = '42501';
  end if;
  return json_build_object(
    'checked_in', (
      select coalesce(json_agg(json_build_object('classroom_id', room, 'n', n)), '[]'::json) from (
        select e.classroom_id as room, count(distinct ci.child_id)::int as n
          from checkins ci
          join facility_enrollments e on e.child_id = ci.child_id and e.facility_id = p_facility and e.status = 'active'
         where ci.facility_id = p_facility and ci.status = 'in'
           and ci.checked_at >= (p_day::timestamp at time zone 'America/Chicago')
           and ci.checked_at <  ((p_day + 1)::timestamp at time zone 'America/Chicago')
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

-- Free / reduced / paid for the food program claim (from the family's income form). Office only.
create table public.daycare_cacfp_children (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  category    text not null check (category in ('free', 'reduced', 'paid')),
  form_date   date,
  updated_by_name text,
  updated_at  timestamptz not null default now(),
  primary key (facility_id, child_id)
);
alter table public.daycare_cacfp_children enable row level security;
create policy "daycare_cacfp_children: managers read" on public.daycare_cacfp_children for select
  using (is_facility_manager(facility_id) or is_admin());
create policy "daycare_cacfp_children: managers add" on public.daycare_cacfp_children for insert
  with check (is_facility_manager(facility_id) and facility_has_child(facility_id, child_id));
create policy "daycare_cacfp_children: managers change" on public.daycare_cacfp_children for update
  using (is_facility_manager(facility_id)) with check (is_facility_manager(facility_id));
create policy "daycare_cacfp_children: managers remove" on public.daycare_cacfp_children for delete
  using (is_facility_manager(facility_id));
create trigger daycare_cacfp_children_stamp before insert or update on public.daycare_cacfp_children
  for each row execute function public.daycare_kitchen_stamp();

-- The month's food program numbers. A meal counts once per child per meal per day. Also flags
-- children with more meals than the program pays for in a day (2 meals + 1 snack, or 1 meal +
-- 2 snacks), meals logged for a child who wasn't checked in that day, and meal entries that
-- don't say which meal they were.
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
      select (ci.checked_at at time zone 'America/Chicago')::date as day, ci.child_id
        from checkins ci
       where ci.facility_id = p_facility and ci.status = 'in'
         and ci.checked_at >= (v_from::timestamp at time zone 'America/Chicago')
         and ci.checked_at <  ((v_to + 1)::timestamp at time zone 'America/Chicago')
       group by 1, 2
    ), cat as (
      select child_id, category from daycare_cacfp_children where facility_id = p_facility
    ), per_child as (
      select day, child_id,
             count(*) filter (where meal in ('breakfast', 'lunch', 'supper'))::int as meals,
             count(*) filter (where meal in ('am_snack', 'pm_snack'))::int as snacks,
             array_agg(meal order by array_position(array['breakfast', 'am_snack', 'lunch', 'pm_snack', 'supper'], meal)) as which
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

-- ── Food orders ─────────────────────────────────────────────────────────────────
create table public.daycare_food_orders (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  vendor          text not null check (char_length(btrim(vendor)) between 1 and 100),
  status          text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'canceled')),
  needed_by       date,
  items           jsonb not null default '[]' check (daycare_valid_order_items(items)),
  total           numeric(10, 2) check (total is null or total between 0 and 100000),
  note            text check (char_length(note) <= 500),
  ordered_at      timestamptz,
  received_at     timestamptz,
  received_by_name text,
  expense_id      uuid references public.daycare_expenses(id) on delete set null,
  created_by      uuid,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index daycare_food_orders_facility on public.daycare_food_orders (facility_id, created_at desc);
alter table public.daycare_food_orders enable row level security;
create policy "daycare_food_orders: kitchen" on public.daycare_food_orders for all
  using (is_kitchen_staff(facility_id) or is_admin()) with check (is_kitchen_staff(facility_id) or is_admin());

-- From the app: who made it and when it was ordered/received are set here; the expense link is
-- set only by daycare_food_order_expense(). Server-side code (that function, foreign-key updates)
-- runs as another role and skips this.
create or replace function public.daycare_food_orders_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.expense_id := null;
    new.created_by := auth.uid();
    new.created_by_name := coalesce(facility_staff_name(new.facility_id), 'Staff');
    new.created_at := now();
  else
    new.facility_id := old.facility_id; new.expense_id := old.expense_id;
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
  end if;
  if new.status = 'ordered' and (tg_op = 'INSERT' or old.status is distinct from 'ordered') then new.ordered_at := now(); end if;
  if new.status = 'received' and (tg_op = 'INSERT' or old.status is distinct from 'received') then
    new.received_at := now(); new.received_by_name := facility_staff_name(new.facility_id);
  elsif new.status <> 'received' then
    new.received_at := null; new.received_by_name := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger daycare_food_orders_guard before insert or update on public.daycare_food_orders
  for each row execute function public.daycare_food_orders_guard();

-- The office adds a received order to Office → Expenses as Food (once)
create or replace function public.daycare_food_order_expense(p_id uuid, p_amount numeric, p_date date default null, p_method text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o daycare_food_orders; v_id uuid; v_n int;
begin
  select * into o from daycare_food_orders where id = p_id for update;
  if o.id is null or not (is_facility_manager(o.facility_id) or is_admin()) then
    raise exception 'Only the director or office can add expenses.' using errcode = '42501';
  end if;
  if o.expense_id is not null then raise exception 'This order is already in your expenses.' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then raise exception 'Enter the amount paid.' using errcode = '22023'; end if;
  if p_method is not null and p_method not in ('cash', 'check', 'card', 'ach', 'other') then
    raise exception 'Unknown payment method.' using errcode = '22023';
  end if;
  if p_date is not null and p_date > daycare_today() then raise exception 'The date can''t be in the future.' using errcode = '22023'; end if;
  v_n := jsonb_array_length(o.items);
  insert into daycare_expenses (facility_id, expense_date, vendor, category, description, amount, method)
  values (o.facility_id, coalesce(p_date, (coalesce(o.received_at, now()) at time zone 'America/Chicago')::date), left(o.vendor, 120), 'food',
          case when v_n > 0 then format('Food order: %s item%s', v_n, case when v_n = 1 then '' else 's' end) else 'Food order' end,
          round(p_amount, 2), p_method)
  returning id into v_id;
  update daycare_food_orders set expense_id = v_id, total = coalesce(total, round(p_amount, 2)), updated_at = now() where id = p_id;
  return v_id;
end $$;

-- ── Fridge and freezer temperatures ─────────────────────────────────────────────
create table public.daycare_temp_units (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  kind        text not null check (kind in ('fridge', 'freezer')),
  max_f       numeric(5, 1) not null check (max_f between -40 and 60),
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.daycare_temp_units enable row level security;
create policy "daycare_temp_units: kitchen" on public.daycare_temp_units for all
  using (is_kitchen_staff(facility_id) or is_admin()) with check (is_kitchen_staff(facility_id) or is_admin());

create table public.daycare_temp_logs (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references public.facilities(id) on delete cascade,
  unit_id        uuid not null references public.daycare_temp_units(id) on delete cascade,
  reading_f      numeric(5, 1) not null check (reading_f between -40 and 100),
  out_of_range   boolean not null default false,
  action         text check (char_length(action) <= 300),
  logged_at      timestamptz not null default now(),
  logged_by      uuid,
  logged_by_name text
);
create index daycare_temp_logs_unit on public.daycare_temp_logs (unit_id, logged_at desc);
alter table public.daycare_temp_logs enable row level security;
create policy "daycare_temp_logs: kitchen read" on public.daycare_temp_logs for select
  using (is_kitchen_staff(facility_id) or is_admin());
create policy "daycare_temp_logs: kitchen add" on public.daycare_temp_logs for insert
  with check (is_kitchen_staff(facility_id));
create policy "daycare_temp_logs: fix a mistake" on public.daycare_temp_logs for delete
  using ((logged_by = auth.uid() and logged_at > now() - interval '1 hour') or is_facility_manager(facility_id));

-- Readings are stamped now, by the person logging them; the daycare comes from the unit, and
-- "out of range" is worked out here from the unit's limit.
create or replace function public.daycare_temp_logs_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
declare u daycare_temp_units;
begin
  select * into u from daycare_temp_units where id = new.unit_id;
  if u.id is null then raise exception 'Unknown fridge or freezer.' using errcode = '22023'; end if;
  new.facility_id := u.facility_id;
  new.out_of_range := new.reading_f > u.max_f;
  new.logged_at := now();
  new.logged_by := auth.uid();
  new.logged_by_name := coalesce(facility_staff_name(u.facility_id), 'Staff');
  return new;
end $$;
create trigger daycare_temp_logs_stamp before insert on public.daycare_temp_logs
  for each row execute function public.daycare_temp_logs_stamp();

-- ── Grants ──────────────────────────────────────────────────────────────────────
revoke all on public.daycare_kitchen_settings, public.daycare_foods, public.daycare_menu_weeks, public.daycare_menus,
              public.daycare_meal_subs, public.daycare_cacfp_children, public.daycare_food_orders,
              public.daycare_temp_units, public.daycare_temp_logs from anon;
revoke execute on function public.daycare_kitchen_children(uuid), public.daycare_meal_counts(uuid, date),
                           public.daycare_cacfp_month(uuid, date), public.daycare_food_order_expense(uuid, numeric, date, text)
  from public, anon;
grant execute on function public.daycare_kitchen_children(uuid), public.daycare_meal_counts(uuid, date),
                          public.daycare_cacfp_month(uuid, date), public.daycare_food_order_expense(uuid, numeric, date, text)
  to authenticated;
