-- Daycare phase 3A: daily care logs + the day's report, incident / accident reports,
-- and a resources page the daycare fills in for parents.
--
-- Who sees what
--   care_logs / daily_reports : any active staff at the daycare (teachers float between
--     rooms), and the child's parents (admin/member), live as the day fills in.
--   incident_reports           : the director/office, whoever wrote it, and the child's
--     home-room teachers; parents once the office has sent it. Never deleted: after
--     sending, changes are corrections appended by the office.
--   facility_resources         : staff, and members of families connected to the daycare
--     (published ones only). Written by the director/office.

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.facility_has_child(p_facility_id uuid, p_child_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from facility_enrollments
                  where facility_id = p_facility_id and child_id = p_child_id and status = 'active')
$$;

create or replace function public.facility_staff_name(p_facility_id uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce(nullif(trim(name), ''), split_part(email, '@', 1))
    from facility_staff
   where facility_id = p_facility_id and user_id = auth.uid() and status = 'active'
   limit 1
$$;

-- A member of a family that is connected (active) to this daycare
create or replace function public.is_facility_family_member(p_facility_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from facility_families ff
      join members m on m.family_id = ff.family_id
     where ff.facility_id = p_facility_id and ff.status = 'active'
       and m.user_id = auth.uid() and m.status = 'active')
$$;

-- ── Daily care logs ──────────────────────────────────────────────────────────
create table public.care_logs (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  child_id        uuid not null references public.children(id) on delete cascade,
  day             date not null,                       -- the daycare's calendar day
  kind            text not null check (kind in ('meal','bottle','nap','diaper','potty','mood','activity','medicine','note')),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,                         -- naps
  amount          text check (char_length(amount) <= 40),   -- meal: all/most/some/none; bottle: ounces
  detail          text check (char_length(detail) <= 200),  -- diaper/potty result, mood, medicine name + dose, what was served
  note            text check (char_length(note) <= 1000),
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint care_logs_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index care_logs_facility_day on public.care_logs (facility_id, day);
create index care_logs_child_day    on public.care_logs (child_id, day);

create table public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  facility_id   uuid not null references public.facilities(id) on delete cascade,
  child_id      uuid not null references public.children(id) on delete cascade,
  day           date not null,
  teacher_note  text check (char_length(teacher_note) <= 2000),
  sent_at       timestamptz,
  sent_by       uuid references auth.users(id) on delete set null,
  sent_by_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (facility_id, child_id, day)
);

create or replace function public.daily_report_sent(p_facility_id uuid, p_child_id uuid, p_day date)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from daily_reports where facility_id = p_facility_id and child_id = p_child_id
                    and day = p_day and sent_at is not null)
$$;

create or replace function public.care_logs_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.created_by_name := facility_staff_name(new.facility_id);
    end if;
    new.created_at := now();
  else
    -- Foreign-key clean-up (a deleted login sets created_by to null) passes straight through
    if pg_trigger_depth() > 1 then return new; end if;
    new.facility_id := old.facility_id;
    new.child_id := old.child_id;
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_care_logs_stamp before insert or update on public.care_logs
  for each row execute function public.care_logs_stamp();

alter table public.care_logs enable row level security;
create policy "care_logs: read" on public.care_logs for select
  using (is_facility_staff(facility_id) or is_child_parent(child_id) or is_admin());
create policy "care_logs: staff add" on public.care_logs for insert
  with check (is_facility_staff(facility_id) and facility_has_child(facility_id, child_id));
-- After the day's report is sent, only the director/office change earlier entries
create policy "care_logs: staff change" on public.care_logs for update
  using (is_facility_staff(facility_id) and (is_facility_manager(facility_id) or not daily_report_sent(facility_id, child_id, day)))
  with check (is_facility_staff(facility_id));
create policy "care_logs: staff remove" on public.care_logs for delete
  using (is_facility_staff(facility_id) and (is_facility_manager(facility_id) or not daily_report_sent(facility_id, child_id, day)));

alter table public.daily_reports enable row level security;
create policy "daily_reports: read" on public.daily_reports for select
  using (is_facility_staff(facility_id) or is_child_parent(child_id) or is_admin());
-- Written only through send_daily_report()

create or replace function public.send_daily_report(p_facility_id uuid, p_child_id uuid, p_day date, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not is_facility_staff(p_facility_id) then
    raise exception 'Only this daycare''s staff can send a daily report.' using errcode = '42501';
  end if;
  if not facility_has_child(p_facility_id, p_child_id) then
    raise exception 'This child isn''t enrolled here.' using errcode = '22023';
  end if;
  if p_day > current_date + 1 or p_day < current_date - 7 then
    raise exception 'Daily reports can be sent for the past week only.' using errcode = '22023';
  end if;
  insert into daily_reports (facility_id, child_id, day, teacher_note, sent_at, sent_by, sent_by_name)
  values (p_facility_id, p_child_id, p_day, nullif(trim(left(p_note, 2000)), ''), now(), auth.uid(), facility_staff_name(p_facility_id))
  on conflict (facility_id, child_id, day) do update
     set teacher_note = excluded.teacher_note, sent_at = now(), sent_by = auth.uid(),
         sent_by_name = excluded.sent_by_name, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- ── Incident / accident reports ──────────────────────────────────────────────
create table public.incident_reports (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references public.facilities(id) on delete cascade,
  child_id           uuid not null references public.children(id) on delete cascade,
  classroom_id       uuid references public.classrooms(id) on delete set null,
  kind               text not null check (kind in ('injury','illness','behavior','other')),
  occurred_at        timestamptz not null,
  location           text check (char_length(location) <= 200),
  description        text not null check (char_length(description) between 1 and 4000),
  first_aid          text check (char_length(first_aid) <= 2000),
  witness            text check (char_length(witness) <= 200),
  parent_told_at     timestamptz,
  parent_told_how    text check (parent_told_how in ('phone','in_person','text','other')),
  status             text not null default 'review' check (status in ('review','sent','signed')),
  reported_by        uuid references auth.users(id) on delete set null,
  reported_by_name   text,
  sent_by            uuid references auth.users(id) on delete set null,
  sent_by_name       text,
  sent_at            timestamptz,
  parent_signed_by   uuid references auth.users(id) on delete set null,
  parent_signed_name text,
  parent_signed_at   timestamptz,
  parent_comment     text check (char_length(parent_comment) <= 1000),
  corrections        jsonb not null default '[]'::jsonb,   -- [{ at, by_name, text }] added after sending
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index incident_reports_facility on public.incident_reports (facility_id, occurred_at desc);
create index incident_reports_child    on public.incident_reports (child_id);

create or replace function public.incident_reports_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rpc boolean := coalesce(current_setting('littleloop.incident_rpc', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.status := 'review';
    new.reported_by := auth.uid();
    new.reported_by_name := facility_staff_name(new.facility_id);
    new.sent_by := null; new.sent_by_name := null; new.sent_at := null;
    new.parent_signed_by := null; new.parent_signed_name := null; new.parent_signed_at := null; new.parent_comment := null;
    new.corrections := '[]'::jsonb;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  -- Foreign-key clean-up (a deleted child or daycare cascades, a deleted login is set to
  -- null) passes through; nothing a person does directly runs this deep.
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Incident reports are kept for your records and can''t be deleted.' using errcode = '42501';
  end if;
  -- UPDATE
  if not v_rpc then
    if old.status <> 'review' then
      raise exception 'This report was sent to the family. Add a correction instead of changing it.' using errcode = '42501';
    end if;
    -- Content edits only while in review; workflow fields belong to the RPCs
    new.status := old.status;
    new.reported_by := old.reported_by; new.reported_by_name := old.reported_by_name;
    new.sent_by := old.sent_by; new.sent_by_name := old.sent_by_name; new.sent_at := old.sent_at;
    new.parent_signed_by := old.parent_signed_by; new.parent_signed_name := old.parent_signed_name;
    new.parent_signed_at := old.parent_signed_at; new.parent_comment := old.parent_comment;
    new.corrections := old.corrections;
  end if;
  new.facility_id := old.facility_id;
  new.child_id := old.child_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_incident_reports_guard before insert or update or delete on public.incident_reports
  for each row execute function public.incident_reports_guard();

alter table public.incident_reports enable row level security;
create policy "incident_reports: read" on public.incident_reports for select
  using (is_facility_manager(facility_id) or reported_by = auth.uid()
         or can_staff_see_child_docs(facility_id, child_id)
         or (status in ('sent','signed') and is_child_parent(child_id))
         or is_admin());
create policy "incident_reports: staff write" on public.incident_reports for insert
  with check (is_facility_staff(facility_id) and facility_has_child(facility_id, child_id));
create policy "incident_reports: edit while in review" on public.incident_reports for update
  using (status = 'review' and (reported_by = auth.uid() or is_facility_manager(facility_id)))
  with check (is_facility_staff(facility_id));
-- No delete policy: reports are never deleted.

create or replace function public.send_incident_report(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r incident_reports;
begin
  select * into r from incident_reports where id = p_id;
  if r.id is null or not is_facility_manager(r.facility_id) then
    raise exception 'Only the director or office can send incident reports.' using errcode = '42501';
  end if;
  if r.status <> 'review' then raise exception 'This report was already sent.' using errcode = '22023'; end if;
  perform set_config('littleloop.incident_rpc', 'on', true);
  update incident_reports set status = 'sent', sent_at = now(), sent_by = auth.uid(),
         sent_by_name = facility_staff_name(r.facility_id)
   where id = p_id;
  perform set_config('littleloop.incident_rpc', 'off', true);
end $$;

create or replace function public.sign_incident_report(p_id uuid, p_name text, p_comment text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r incident_reports;
begin
  select * into r from incident_reports where id = p_id;
  if r.id is null or not is_child_parent(r.child_id) then
    raise exception 'Only the child''s parent can sign this report.' using errcode = '42501';
  end if;
  if r.status = 'signed' then raise exception 'This report is already signed.' using errcode = '22023'; end if;
  if r.status <> 'sent' then raise exception 'This report isn''t ready to sign yet.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Type your full name to sign.' using errcode = '22023';
  end if;
  perform set_config('littleloop.incident_rpc', 'on', true);
  update incident_reports set status = 'signed', parent_signed_by = auth.uid(),
         parent_signed_name = left(trim(p_name), 120), parent_signed_at = now(),
         parent_comment = nullif(trim(left(p_comment, 1000)), '')
   where id = p_id;
  perform set_config('littleloop.incident_rpc', 'off', true);
end $$;

create or replace function public.add_incident_correction(p_id uuid, p_text text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r incident_reports;
begin
  select * into r from incident_reports where id = p_id;
  if r.id is null or not is_facility_manager(r.facility_id) then
    raise exception 'Only the director or office can add a correction.' using errcode = '42501';
  end if;
  if r.status = 'review' then raise exception 'Edit the report directly until it''s sent.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_text, ''))) < 3 then raise exception 'Write the correction.' using errcode = '22023'; end if;
  perform set_config('littleloop.incident_rpc', 'on', true);
  update incident_reports
     set corrections = corrections || jsonb_build_array(jsonb_build_object(
           'at', now(), 'by_name', facility_staff_name(r.facility_id), 'text', left(trim(p_text), 2000)))
   where id = p_id;
  perform set_config('littleloop.incident_rpc', 'off', true);
end $$;

-- ── Parent resources ─────────────────────────────────────────────────────────
create table public.facility_resources (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  category     text not null check (category in ('financial','scholarship','development','newsletter','community','health','other')),
  title        text not null check (char_length(trim(title)) between 1 and 150),
  description  text check (char_length(description) <= 1000),
  url          text check (url is null or (url ~* '^https?://[^\s]+$' and char_length(url) <= 1000)),
  file_path    text,
  file_name    text,
  file_size    integer,
  mime_type    text,
  pinned       boolean not null default false,
  published    boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index facility_resources_facility on public.facility_resources (facility_id, category);

create or replace function public.facility_resources_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then new.created_by := auth.uid(); new.created_at := now();
  else
    if pg_trigger_depth() > 1 then return new; end if;   -- foreign-key clean-up
    new.facility_id := old.facility_id; new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  if new.file_path is not null and split_part(new.file_path, '/', 1) <> new.facility_id::text then
    raise exception 'That file belongs to another daycare.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_facility_resources_stamp before insert or update on public.facility_resources
  for each row execute function public.facility_resources_stamp();

alter table public.facility_resources enable row level security;
create policy "facility_resources: read" on public.facility_resources for select
  using (is_facility_staff(facility_id) or (published and is_facility_family_member(facility_id)) or is_admin());
create policy "facility_resources: managers add" on public.facility_resources for insert
  with check (is_facility_manager(facility_id));
create policy "facility_resources: managers change" on public.facility_resources for update
  using (is_facility_manager(facility_id)) with check (is_facility_manager(facility_id));
create policy "facility_resources: managers remove" on public.facility_resources for delete
  using (is_facility_manager(facility_id));

-- Files: private bucket, path <facility_id>/<uuid>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facility-resources', 'facility-resources', false, 20971520,
        array['application/pdf','image/jpeg','image/png','image/webp',
              'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create or replace function public.facility_resource_storage_ok(p_name text, p_mode text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_fac text := split_part(p_name, '/', 1);
        v_re  text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_fac !~ v_re or split_part(p_name, '/', 2) = '' or split_part(p_name, '/', 3) <> '' or p_name like '%..%' then
    return false;
  end if;
  if p_mode = 'read' then
    return is_facility_staff(v_fac::uuid)
        or (is_facility_family_member(v_fac::uuid)
            and exists (select 1 from facility_resources where file_path = p_name and published));
  end if;
  if p_mode in ('upload', 'delete') then return is_facility_manager(v_fac::uuid); end if;
  return false;
end $$;

create policy "facility-resources: read" on storage.objects for select
  using (bucket_id = 'facility-resources' and facility_resource_storage_ok(name, 'read'));
create policy "facility-resources: upload" on storage.objects for insert
  with check (bucket_id = 'facility-resources' and facility_resource_storage_ok(name, 'upload'));
create policy "facility-resources: delete" on storage.objects for delete
  using (bucket_id = 'facility-resources' and facility_resource_storage_ok(name, 'delete'));

-- ── Grants: signed-in users only (RLS decides the rows) ──────────────────────
revoke all on public.care_logs, public.daily_reports, public.incident_reports, public.facility_resources from anon;
revoke execute on function public.send_daily_report(uuid, uuid, date, text), public.send_incident_report(uuid),
  public.sign_incident_report(uuid, text, text), public.add_incident_correction(uuid, text),
  public.facility_has_child(uuid, uuid), public.facility_staff_name(uuid), public.is_facility_family_member(uuid),
  public.daily_report_sent(uuid, uuid, date), public.facility_resource_storage_ok(text, text) from anon, public;
grant execute on function public.send_daily_report(uuid, uuid, date, text), public.send_incident_report(uuid),
  public.sign_incident_report(uuid, text, text), public.add_incident_correction(uuid, text),
  public.facility_has_child(uuid, uuid), public.facility_staff_name(uuid), public.is_facility_family_member(uuid),
  public.daily_report_sent(uuid, uuid, date), public.facility_resource_storage_ok(text, text) to authenticated;
