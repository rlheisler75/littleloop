-- Daycare GPS time clock (like ElderLoop's Time Clock).
--   daycare_timeclock_settings : the daycare's spot (lat/lng) and radius; require_geofence refuses
--                                punches made farther away.
--   daycare_time_punches       : clock in/out. Staff punch only through daycare_clock_punch(), which
--                                works out in/out, measures the distance on the server and saves
--                                the phone's location at that moment (no tracking in between).
--                                The director/office add a missed punch, fix a time or void one,
--                                always with a reason; punches are never deleted.
-- Who: staff see their own punches; the director/office see everyone's.

create table public.daycare_timeclock_settings (
  facility_id      uuid primary key references public.facilities(id) on delete cascade,
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  radius_m         integer not null default 150 check (radius_m between 25 and 5000),
  require_geofence boolean not null default true,
  updated_at       timestamptz not null default now()
);
alter table public.daycare_timeclock_settings enable row level security;
create policy "daycare_timeclock_settings: staff read" on public.daycare_timeclock_settings for select
  using (is_facility_staff(facility_id) or is_admin());
create policy "daycare_timeclock_settings: managers write" on public.daycare_timeclock_settings for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());

create table public.daycare_time_punches (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references public.facilities(id) on delete cascade,
  staff_id            uuid not null references public.facility_staff(id) on delete cascade,
  punch_type          text not null check (punch_type in ('in', 'out')),
  punched_at          timestamptz not null default now(),
  lat                 double precision,
  lng                 double precision,
  accuracy_m          numeric(9,1),
  distance_m          numeric(10,1),
  within_geofence     boolean,
  source              text not null default 'app' check (source in ('app', 'manager')),
  note                text check (char_length(note) <= 300),
  original_punched_at timestamptz,
  edited_by_name      text,
  edited_at           timestamptz,
  voided_at           timestamptz,
  voided_by_name      text,
  void_reason         text check (char_length(void_reason) <= 300),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index daycare_time_punches_facility on public.daycare_time_punches (facility_id, punched_at);
create index daycare_time_punches_staff on public.daycare_time_punches (staff_id, punched_at);

alter table public.daycare_time_punches enable row level security;
create policy "daycare_time_punches: own or managers read" on public.daycare_time_punches for select
  using (is_facility_manager(facility_id) or is_admin()
         or exists (select 1 from facility_staff s where s.id = staff_id and s.user_id = auth.uid()));
-- No insert/update/delete policies: everything goes through the functions below.

-- Great-circle distance in meters
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Clock in or out (whichever is next) for the signed-in staff member
create or replace function public.daycare_clock_punch(p_facility uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns json language plpgsql security definer set search_path to 'public' as $$
declare v_staff uuid; v_last daycare_time_punches; v_type text; s daycare_timeclock_settings;
        v_dist double precision; v_within boolean; v_id uuid; v_at timestamptz;
begin
  select id into v_staff from facility_staff where facility_id = p_facility and user_id = auth.uid() and status = 'active';
  if v_staff is null then raise exception 'You''re not on staff at this daycare.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('daycare_clock:' || v_staff::text));
  select * into v_last from daycare_time_punches where staff_id = v_staff and voided_at is null order by punched_at desc limit 1;
  if v_last.id is not null and v_last.punched_at > now() - interval '1 minute' then
    raise exception 'You just clocked %. Wait a minute before punching again.', v_last.punch_type using errcode = '22023';
  end if;
  -- A clock-in older than 16 hours was a forgotten clock-out: leave it open for the director and start a new shift
  v_type := case when v_last.punch_type = 'in' and v_last.punched_at > now() - interval '16 hours' then 'out' else 'in' end;
  select * into s from daycare_timeclock_settings where facility_id = p_facility;
  if s.lat is not null and p_lat is not null and p_lng is not null then
    v_dist := geo_distance_m(p_lat, p_lng, s.lat, s.lng);
    v_within := v_dist <= s.radius_m + least(coalesce(p_accuracy, 0), 100);   -- allow for GPS accuracy, up to 100 m
  end if;
  if coalesce(s.require_geofence, false) and s.lat is not null then
    if p_lat is null or p_lng is null then
      raise exception 'Turn on location for littleloop to clock %.', v_type using errcode = '22023';
    end if;
    if not v_within then
      raise exception 'You''re about % ft from the daycare. Clock % within % ft.', round(v_dist * 3.28084), v_type, round(s.radius_m * 3.28084)
        using errcode = '22023';
    end if;
  end if;
  insert into daycare_time_punches (facility_id, staff_id, punch_type, lat, lng, accuracy_m, distance_m, within_geofence, source, created_by)
  values (p_facility, v_staff, v_type, p_lat, p_lng, p_accuracy, v_dist, v_within, 'app', auth.uid())
  returning id, punched_at into v_id, v_at;
  return json_build_object('id', v_id, 'type', v_type, 'punched_at', v_at, 'within', v_within, 'distance_m', round(v_dist::numeric, 1));
end $$;

-- Director/office: a missed punch, a corrected time, or a void (always with a reason)
create or replace function public.daycare_clock_add(p_facility uuid, p_staff uuid, p_type text, p_at timestamptz, p_reason text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not (is_facility_manager(p_facility) or is_admin()) then raise exception 'Only the director or office can add punches.' using errcode = '42501'; end if;
  if not exists (select 1 from facility_staff where id = p_staff and facility_id = p_facility) then raise exception 'Staff member not found.' using errcode = '22023'; end if;
  if p_type not in ('in', 'out') then raise exception 'Choose in or out.' using errcode = '22023'; end if;
  if p_at > now() + interval '5 minutes' then raise exception 'That time is in the future.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it''s being added.' using errcode = '22023'; end if;
  insert into daycare_time_punches (facility_id, staff_id, punch_type, punched_at, source, note, edited_by_name, edited_at, created_by)
  values (p_facility, p_staff, p_type, p_at, 'manager', left(trim(p_reason), 300), facility_staff_name(p_facility), now(), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.daycare_clock_edit(p_id uuid, p_at timestamptz, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r daycare_time_punches;
begin
  select * into r from daycare_time_punches where id = p_id;
  if r.id is null or not (is_facility_manager(r.facility_id) or is_admin()) then raise exception 'Only the director or office can change punches.' using errcode = '42501'; end if;
  if r.voided_at is not null then raise exception 'That punch was voided.' using errcode = '22023'; end if;
  if p_at > now() + interval '5 minutes' then raise exception 'That time is in the future.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it''s being changed.' using errcode = '22023'; end if;
  update daycare_time_punches
     set original_punched_at = coalesce(original_punched_at, punched_at), punched_at = p_at,
         note = left(trim(p_reason), 300), edited_by_name = facility_staff_name(r.facility_id), edited_at = now()
   where id = p_id;
end $$;

create or replace function public.daycare_clock_void(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r daycare_time_punches;
begin
  select * into r from daycare_time_punches where id = p_id;
  if r.id is null or not (is_facility_manager(r.facility_id) or is_admin()) then raise exception 'Only the director or office can void punches.' using errcode = '42501'; end if;
  if r.voided_at is not null then raise exception 'Already voided.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it''s being voided.' using errcode = '22023'; end if;
  update daycare_time_punches set voided_at = now(), voided_by_name = facility_staff_name(r.facility_id), void_reason = left(trim(p_reason), 300)
   where id = p_id;
end $$;

-- Shifts: each clock-in paired with the next punch if it's a clock-out
create or replace function public.daycare_timeclock_hours(p_facility uuid, p_from date, p_to date)
returns table (staff_id uuid, staff_name text, role text, day date, in_id uuid, clock_in timestamptz, out_id uuid,
               clock_out timestamptz, minutes integer, off_site boolean, edited boolean)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see staff hours.' using errcode = '42501';
  end if;
  return query
  with p as (
    select t.* from daycare_time_punches t
     where t.facility_id = p_facility and t.voided_at is null
       and t.punched_at >= (p_from - 1)::timestamp at time zone 'America/Chicago'
       and t.punched_at <  (p_to + 2)::timestamp at time zone 'America/Chicago'
  ), q as (
    select p.*, lead(p.punch_type) over w as n_type, lead(p.punched_at) over w as n_at, lead(p.id) over w as n_id,
           lead(p.within_geofence) over w as n_within, lead(p.source) over w as n_src, lead(p.original_punched_at) over w as n_orig
      from p window w as (partition by p.staff_id order by p.punched_at)
  )
  select s.id, coalesce(nullif(trim(s.name), ''), split_part(s.email, '@', 1)), s.role,
         (q.punched_at at time zone 'America/Chicago')::date, q.id, q.punched_at,
         case when q.n_type = 'out' then q.n_id end, case when q.n_type = 'out' then q.n_at end,
         case when q.n_type = 'out' then round(extract(epoch from (q.n_at - q.punched_at)) / 60)::int end,
         coalesce(q.within_geofence = false, false) or (q.n_type = 'out' and coalesce(q.n_within = false, false)),
         q.source = 'manager' or q.original_punched_at is not null or (q.n_type = 'out' and (q.n_src = 'manager' or q.n_orig is not null))
    from q join facility_staff s on s.id = q.staff_id
   where q.punch_type = 'in' and (q.punched_at at time zone 'America/Chicago')::date between p_from and p_to
   order by 2, 6;
end $$;

revoke all on public.daycare_timeclock_settings, public.daycare_time_punches from anon;
revoke execute on function public.daycare_clock_punch(uuid, double precision, double precision, double precision),
  public.daycare_clock_add(uuid, uuid, text, timestamptz, text), public.daycare_clock_edit(uuid, timestamptz, text),
  public.daycare_clock_void(uuid, text), public.daycare_timeclock_hours(uuid, date, date) from anon, public;
grant execute on function public.daycare_clock_punch(uuid, double precision, double precision, double precision),
  public.daycare_clock_add(uuid, uuid, text, timestamptz, text), public.daycare_clock_edit(uuid, timestamptz, text),
  public.daycare_clock_void(uuid, text), public.daycare_timeclock_hours(uuid, date, date), public.geo_distance_m(double precision, double precision, double precision, double precision)
  to authenticated;
