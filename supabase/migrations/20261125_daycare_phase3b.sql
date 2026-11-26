-- Daycare phase 3B: weekly lesson plans, a skills checklist with progress, and report cards.
--
-- Who sees what
--   lesson_plans       : any active staff at the daycare; members of families with a child
--                        enrolled in that classroom, once the plan is published. Written by the
--                        director/office or the room's own teachers (facility_staff.classroom_id).
--   facility_skills    : the daycare's checklist. Staff read it; the director/office edit it.
--   skill_observations : any active staff (they log progress the way they log the day, and
--                        teachers float). Parents never see raw observations, only report cards.
--   report_cards       : the director/office, the child's home-room teachers, and whoever
--                        started it; parents once the office has sent it. Never deleted after
--                        sending: changes are notes added by the office.

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- The director/office, or a teacher whose home room this is
create or replace function public.is_room_teacher(p_classroom_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from classrooms c
      join facility_staff s on s.facility_id = c.facility_id
     where c.id = p_classroom_id and s.user_id = auth.uid() and s.status = 'active'
       and (s.role in ('director', 'office') or s.classroom_id = c.id))
$$;

-- A member of a connected family with a child enrolled in this classroom
create or replace function public.is_classroom_family_member(p_classroom_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from facility_enrollments e
      join children c on c.id = e.child_id
      join facility_families ff on ff.facility_id = e.facility_id and ff.family_id = c.family_id and ff.status = 'active'
      join members m on m.family_id = c.family_id
     where e.classroom_id = p_classroom_id and e.status = 'active'
       and m.user_id = auth.uid() and m.status = 'active')
$$;

-- ── Lesson plans (one per classroom per week) ────────────────────────────────
create table public.lesson_plans (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references public.facilities(id) on delete cascade,
  classroom_id      uuid not null references public.classrooms(id) on delete cascade,
  week_start        date not null check (extract(isodow from week_start) = 1),   -- a Monday
  theme             text check (char_length(theme) <= 150),
  goals             text check (char_length(goals) <= 2000),
  -- [{ id, day 1-5, area, title, description, materials }]
  activities        jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(activities) = 'array' and jsonb_array_length(activities) <= 150
                           and octet_length(activities::text) <= 120000),
  status            text not null default 'draft' check (status in ('draft', 'published')),
  published_at      timestamptz,
  published_by_name text,
  created_by        uuid references auth.users(id) on delete set null,
  created_by_name   text,
  updated_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (classroom_id, week_start)
);
create index lesson_plans_facility_week on public.lesson_plans (facility_id, week_start);

create or replace function public.lesson_plans_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from classrooms where id = new.classroom_id and facility_id = new.facility_id) then
      raise exception 'That classroom belongs to another daycare.' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.created_by_name := facility_staff_name(new.facility_id);
    new.created_at := now();
    new.published_at := null; new.published_by_name := null;
  else
    if pg_trigger_depth() > 1 then return new; end if;   -- foreign-key clean-up
    new.facility_id := old.facility_id;
    new.classroom_id := old.classroom_id;
    new.week_start := old.week_start;
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
    new.published_at := old.published_at; new.published_by_name := old.published_by_name;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
    new.published_by_name := facility_staff_name(new.facility_id);
  elsif new.status = 'draft' then
    new.published_at := null; new.published_by_name := null;
  end if;
  new.updated_by_name := facility_staff_name(new.facility_id);
  new.updated_at := now();
  return new;
end $$;
create trigger trg_lesson_plans_stamp before insert or update on public.lesson_plans
  for each row execute function public.lesson_plans_stamp();

alter table public.lesson_plans enable row level security;
create policy "lesson_plans: read" on public.lesson_plans for select
  using (is_facility_staff(facility_id) or (status = 'published' and is_classroom_family_member(classroom_id)) or is_admin());
create policy "lesson_plans: room teachers add" on public.lesson_plans for insert
  with check (is_facility_staff(facility_id) and is_room_teacher(classroom_id));
create policy "lesson_plans: room teachers change" on public.lesson_plans for update
  using (is_room_teacher(classroom_id)) with check (is_room_teacher(classroom_id));
create policy "lesson_plans: room teachers remove" on public.lesson_plans for delete
  using (is_room_teacher(classroom_id));

-- ── Skills checklist ─────────────────────────────────────────────────────────
create table public.facility_skills (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  domain       text not null check (domain in ('social','language','cognitive','literacy','math','gross_motor','fine_motor','self_care')),
  band         text not null check (band in ('infant','toddler','preschool')),
  name         text not null check (char_length(trim(name)) between 1 and 200),
  sort         integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index facility_skills_facility on public.facility_skills (facility_id, band, domain, sort);

alter table public.facility_skills enable row level security;
create policy "facility_skills: staff read" on public.facility_skills for select
  using (is_facility_staff(facility_id) or is_admin());
create policy "facility_skills: managers add" on public.facility_skills for insert
  with check (is_facility_manager(facility_id));
create policy "facility_skills: managers change" on public.facility_skills for update
  using (is_facility_manager(facility_id)) with check (is_facility_manager(facility_id));
create policy "facility_skills: managers remove" on public.facility_skills for delete
  using (is_facility_manager(facility_id));

create table public.skill_observations (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  child_id        uuid not null references public.children(id) on delete cascade,
  skill_id        uuid not null references public.facility_skills(id) on delete cascade,
  level           text not null check (level in ('not_yet','emerging','developing','achieved')),
  note            text check (char_length(note) <= 500),
  observed_on     date not null default current_date,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);
create index skill_observations_child on public.skill_observations (child_id, skill_id, observed_on desc, created_at desc);
create index skill_observations_facility on public.skill_observations (facility_id, observed_on);

create or replace function public.skill_observations_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from facility_skills where id = new.skill_id and facility_id = new.facility_id) then
      raise exception 'That skill belongs to another daycare.' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.created_by_name := facility_staff_name(new.facility_id);
    new.created_at := now();
  else
    if pg_trigger_depth() > 1 then return new; end if;   -- foreign-key clean-up
    new.facility_id := old.facility_id; new.child_id := old.child_id; new.skill_id := old.skill_id;
    new.created_by := old.created_by; new.created_by_name := old.created_by_name; new.created_at := old.created_at;
  end if;
  if new.observed_on > current_date + 1 then
    raise exception 'The date is in the future.' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger trg_skill_observations_stamp before insert or update on public.skill_observations
  for each row execute function public.skill_observations_stamp();

alter table public.skill_observations enable row level security;
create policy "skill_observations: staff read" on public.skill_observations for select
  using (is_facility_staff(facility_id) or is_admin());
create policy "skill_observations: staff add" on public.skill_observations for insert
  with check (is_facility_staff(facility_id) and facility_has_child(facility_id, child_id));
create policy "skill_observations: author or office change" on public.skill_observations for update
  using (is_facility_staff(facility_id) and (created_by = auth.uid() or is_facility_manager(facility_id)))
  with check (is_facility_staff(facility_id));
create policy "skill_observations: author or office remove" on public.skill_observations for delete
  using (is_facility_staff(facility_id) and (created_by = auth.uid() or is_facility_manager(facility_id)));

-- ── Report cards ─────────────────────────────────────────────────────────────
create table public.report_cards (
  id                uuid primary key default gen_random_uuid(),
  facility_id       uuid not null references public.facilities(id) on delete cascade,
  child_id          uuid not null references public.children(id) on delete cascade,
  classroom_id      uuid references public.classrooms(id) on delete set null,
  period            text not null check (char_length(trim(period)) between 1 and 80),   -- e.g. "Fall 2026"
  period_start      date,
  period_end        date,
  band              text check (band in ('infant','toddler','preschool')),
  -- Snapshot so later observations don't change a card: [{ skill_id, domain, name, level, note }]
  skills            jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(skills) = 'array' and octet_length(skills::text) <= 200000),
  comments          jsonb not null default '{}'::jsonb      -- { domain: teacher comment }
                    check (jsonb_typeof(comments) = 'object' and octet_length(comments::text) <= 40000),
  summary           text check (char_length(summary) <= 3000),     -- strengths / how the term went
  next_steps        text check (char_length(next_steps) <= 2000),  -- goals for next term
  status            text not null default 'draft' check (status in ('draft','sent')),
  created_by        uuid references auth.users(id) on delete set null,
  created_by_name   text,
  updated_by_name   text,
  sent_at           timestamptz,
  sent_by           uuid references auth.users(id) on delete set null,
  sent_by_name      text,
  parent_seen_at    timestamptz,
  parent_seen_by    uuid references auth.users(id) on delete set null,
  parent_seen_name  text,
  parent_comment    text check (char_length(parent_comment) <= 1000),
  notes             jsonb not null default '[]'::jsonb,   -- [{ at, by_name, text }] added after sending
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint report_cards_period_order check (period_start is null or period_end is null or period_end >= period_start)
);
create index report_cards_facility on public.report_cards (facility_id, created_at desc);
create index report_cards_child    on public.report_cards (child_id);

create or replace function public.report_cards_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rpc boolean := coalesce(current_setting('littleloop.report_card_rpc', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.classroom_id is not null and not exists (select 1 from classrooms where id = new.classroom_id and facility_id = new.facility_id) then
      raise exception 'That classroom belongs to another daycare.' using errcode = '42501';
    end if;
    new.status := 'draft';
    new.created_by := auth.uid();
    new.created_by_name := facility_staff_name(new.facility_id);
    new.updated_by_name := new.created_by_name;
    new.sent_at := null; new.sent_by := null; new.sent_by_name := null;
    new.parent_seen_at := null; new.parent_seen_by := null; new.parent_seen_name := null; new.parent_comment := null;
    new.notes := '[]'::jsonb;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  -- Foreign-key clean-up (a deleted child, room or daycare, a deleted login) passes through
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Sent report cards are kept for your records and can''t be deleted.' using errcode = '42501';
    end if;
    return old;
  end if;
  -- UPDATE
  if not v_rpc then
    if old.status <> 'draft' then
      raise exception 'This report card was sent to the family. Add a note instead of changing it.' using errcode = '42501';
    end if;
    new.status := old.status;
    new.sent_at := old.sent_at; new.sent_by := old.sent_by; new.sent_by_name := old.sent_by_name;
    new.parent_seen_at := old.parent_seen_at; new.parent_seen_by := old.parent_seen_by;
    new.parent_seen_name := old.parent_seen_name; new.parent_comment := old.parent_comment;
    new.notes := old.notes;
    new.updated_by_name := facility_staff_name(old.facility_id);
  end if;
  new.facility_id := old.facility_id;
  new.child_id := old.child_id;
  new.created_by := old.created_by; new.created_by_name := old.created_by_name;
  new.created_at := old.created_at;
  if new.classroom_id is distinct from old.classroom_id and new.classroom_id is not null
     and not exists (select 1 from classrooms where id = new.classroom_id and facility_id = old.facility_id) then
    raise exception 'That classroom belongs to another daycare.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_report_cards_guard before insert or update or delete on public.report_cards
  for each row execute function public.report_cards_guard();

alter table public.report_cards enable row level security;
create policy "report_cards: read" on public.report_cards for select
  using (can_staff_see_child_docs(facility_id, child_id) or created_by = auth.uid()
         or (status = 'sent' and is_child_parent(child_id))
         or is_admin());
create policy "report_cards: teachers start" on public.report_cards for insert
  with check (can_staff_see_child_docs(facility_id, child_id) and facility_has_child(facility_id, child_id));
create policy "report_cards: edit drafts" on public.report_cards for update
  using (status = 'draft' and (can_staff_see_child_docs(facility_id, child_id) or created_by = auth.uid()))
  with check (is_facility_staff(facility_id));
create policy "report_cards: remove drafts" on public.report_cards for delete
  using (status = 'draft' and (created_by = auth.uid() or is_facility_manager(facility_id)));

create or replace function public.send_report_card(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r report_cards;
begin
  select * into r from report_cards where id = p_id;
  if r.id is null or not is_facility_manager(r.facility_id) then
    raise exception 'Only the director or office can send report cards.' using errcode = '42501';
  end if;
  if r.status <> 'draft' then raise exception 'This report card was already sent.' using errcode = '22023'; end if;
  if jsonb_array_length(r.skills) = 0 and coalesce(trim(r.summary), '') = '' then
    raise exception 'Add skills or a summary before sending.' using errcode = '22023';
  end if;
  perform set_config('littleloop.report_card_rpc', 'on', true);
  update report_cards set status = 'sent', sent_at = now(), sent_by = auth.uid(),
         sent_by_name = facility_staff_name(r.facility_id)
   where id = p_id;
  perform set_config('littleloop.report_card_rpc', 'off', true);
end $$;

-- A parent marks it read, with an optional note back to the teacher
create or replace function public.acknowledge_report_card(p_id uuid, p_comment text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r report_cards; v_name text;
begin
  select * into r from report_cards where id = p_id;
  if r.id is null or not is_child_parent(r.child_id) then
    raise exception 'Only the child''s parent can do that.' using errcode = '42501';
  end if;
  if r.status <> 'sent' then raise exception 'This report card isn''t ready yet.' using errcode = '22023'; end if;
  if r.parent_seen_at is not null then raise exception 'You already marked this report card as read.' using errcode = '22023'; end if;
  select coalesce(nullif(trim(m.name), ''), split_part(m.email, '@', 1)) into v_name
    from members m join children c on c.family_id = m.family_id
   where c.id = r.child_id and m.user_id = auth.uid() and m.status = 'active'
   limit 1;
  perform set_config('littleloop.report_card_rpc', 'on', true);
  update report_cards set parent_seen_at = now(), parent_seen_by = auth.uid(),
         parent_seen_name = left(coalesce(v_name, 'Parent'), 120),
         parent_comment = nullif(trim(left(p_comment, 1000)), '')
   where id = p_id;
  perform set_config('littleloop.report_card_rpc', 'off', true);
end $$;

create or replace function public.add_report_card_note(p_id uuid, p_text text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r report_cards;
begin
  select * into r from report_cards where id = p_id;
  if r.id is null or not is_facility_manager(r.facility_id) then
    raise exception 'Only the director or office can add a note.' using errcode = '42501';
  end if;
  if r.status = 'draft' then raise exception 'Edit the report card directly until it''s sent.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_text, ''))) < 3 then raise exception 'Write the note.' using errcode = '22023'; end if;
  perform set_config('littleloop.report_card_rpc', 'on', true);
  update report_cards
     set notes = notes || jsonb_build_array(jsonb_build_object(
           'at', now(), 'by_name', facility_staff_name(r.facility_id), 'text', left(trim(p_text), 2000)))
   where id = p_id;
  perform set_config('littleloop.report_card_rpc', 'off', true);
end $$;

-- ── Grants: signed-in users only (RLS decides the rows) ──────────────────────
revoke all on public.lesson_plans, public.facility_skills, public.skill_observations, public.report_cards from anon;
revoke execute on function public.is_room_teacher(uuid), public.is_classroom_family_member(uuid),
  public.send_report_card(uuid), public.acknowledge_report_card(uuid, text), public.add_report_card_note(uuid, text)
  from anon, public;
grant execute on function public.is_room_teacher(uuid), public.is_classroom_family_member(uuid),
  public.send_report_card(uuid), public.acknowledge_report_card(uuid, text), public.add_report_card_note(uuid, text)
  to authenticated;
