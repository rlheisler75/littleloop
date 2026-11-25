-- Daycare phase 4B: books and office reports (money going out + reports).
--
--   daycare_recurring_expenses : rent, payroll service, insurance ... posted automatically
--                                (daycare_post_recurring_expenses, daily pg_cron).
--   daycare_expenses           : every expense, with an optional receipt (private bucket
--                                daycare-receipts at <facility_id>/<uuid>.<ext>).
--   daycare_pnl()              : profit and loss on a cash basis (payments received vs expenses).
--   daycare_attendance()       : each child's days and hours from the daycare's check-ins.
--   daycare_staff_hours()      : each staff member's hours from their room sign-ins.
-- Who: the director and office only (is_facility_manager). The QuickBooks export is built in the
-- app from the ledger and expenses.

-- ── Expenses ─────────────────────────────────────────────────────────────────
create table public.daycare_recurring_expenses (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  vendor      text check (char_length(vendor) <= 120),
  category    text not null check (category in ('payroll','benefits','rent','utilities','food','classroom_supplies','cleaning','repairs',
                'equipment','insurance','licenses','training','transportation','marketing','office','professional','taxes','bank_fees','other')),
  description text check (char_length(description) <= 300),
  amount      numeric(10,2) not null check (amount > 0),
  method      text check (method in ('cash','check','card','ach','other')),
  frequency   text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  next_date   date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.daycare_expenses (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  expense_date    date not null default daycare_today(),
  vendor          text check (char_length(vendor) <= 120),
  category        text not null check (category in ('payroll','benefits','rent','utilities','food','classroom_supplies','cleaning','repairs',
                    'equipment','insurance','licenses','training','transportation','marketing','office','professional','taxes','bank_fees','other')),
  description     text check (char_length(description) <= 300),
  amount          numeric(10,2) not null check (amount > 0),
  method          text check (method in ('cash','check','card','ach','other')),
  reference       text check (char_length(reference) <= 60),
  receipt_path    text,
  receipt_name    text check (char_length(receipt_name) <= 255),
  recurring_id    uuid references public.daycare_recurring_expenses(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index daycare_expenses_facility_date on public.daycare_expenses (facility_id, expense_date);

create or replace function public.daycare_expenses_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := coalesce(facility_staff_name(new.facility_id), case when auth.uid() is null then 'Automatic' end);
    new.created_at := now();
  else
    if pg_trigger_depth() > 1 then return new; end if;   -- foreign-key clean-up
    new.facility_id := old.facility_id; new.created_by := old.created_by;
    new.created_by_name := old.created_by_name; new.created_at := old.created_at;
  end if;
  if new.receipt_path is not null and split_part(new.receipt_path, '/', 1) <> new.facility_id::text then
    raise exception 'That receipt belongs to another daycare.' using errcode = '42501';
  end if;
  if new.expense_date > daycare_today() + 366 then raise exception 'That date is too far ahead.' using errcode = '22023'; end if;
  new.amount := round(new.amount, 2);
  new.updated_at := now();
  return new;
end $$;
create trigger trg_daycare_expenses_stamp before insert or update on public.daycare_expenses
  for each row execute function public.daycare_expenses_stamp();

create or replace function public.daycare_recurring_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' then
    if pg_trigger_depth() > 1 then return new; end if;
    new.facility_id := old.facility_id; new.created_at := old.created_at;
  end if;
  new.amount := round(new.amount, 2);
  new.updated_at := now();
  return new;
end $$;
create trigger trg_daycare_recurring_stamp before insert or update on public.daycare_recurring_expenses
  for each row execute function public.daycare_recurring_stamp();

alter table public.daycare_expenses enable row level security;
create policy "daycare_expenses: managers" on public.daycare_expenses for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());
alter table public.daycare_recurring_expenses enable row level security;
create policy "daycare_recurring_expenses: managers" on public.daycare_recurring_expenses for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());

-- Recurring expenses due today or earlier become expenses (each missed one too, up to a year back)
create or replace function public.daycare_post_recurring_expenses()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare r record; v_date date; n int := 0; guard int;
begin
  if is_client_request() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  for r in select * from daycare_recurring_expenses where active and next_date <= daycare_today() for update skip locked loop
    v_date := r.next_date; guard := 0;
    while v_date <= daycare_today() and guard < 60 loop
      if v_date >= daycare_today() - 366 then
        insert into daycare_expenses (facility_id, expense_date, vendor, category, description, amount, method, recurring_id)
        values (r.facility_id, v_date, r.vendor, r.category, r.description, r.amount, r.method, r.id);
        n := n + 1;
      end if;
      v_date := case r.frequency when 'weekly' then v_date + 7
                                 when 'monthly' then (v_date + interval '1 month')::date
                                 when 'quarterly' then (v_date + interval '3 months')::date
                                 else (v_date + interval '1 year')::date end;
      guard := guard + 1;
    end loop;
    update daycare_recurring_expenses set next_date = v_date where id = r.id;
  end loop;
  return n;
end $$;

-- ── Receipts ─────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('daycare-receipts', 'daycare-receipts', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create or replace function public.daycare_receipt_ok(p_name text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_fac text := split_part(p_name, '/', 1);
begin
  if v_fac !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or split_part(p_name, '/', 2) = '' or split_part(p_name, '/', 3) <> '' or p_name like '%..%' then
    return false;
  end if;
  return is_facility_manager(v_fac::uuid) or is_admin();
end $$;
create policy "daycare-receipts: read" on storage.objects for select
  using (bucket_id = 'daycare-receipts' and daycare_receipt_ok(name));
create policy "daycare-receipts: upload" on storage.objects for insert
  with check (bucket_id = 'daycare-receipts' and daycare_receipt_ok(name));
create policy "daycare-receipts: delete" on storage.objects for delete
  using (bucket_id = 'daycare-receipts' and daycare_receipt_ok(name));

-- ── Reports ──────────────────────────────────────────────────────────────────
-- Cash basis: money actually received (family and agency payments) and spent, by month.
create or replace function public.daycare_pnl(p_facility uuid, p_from date, p_to date)
returns table (month date, section text, category text, amount numeric)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see the books.' using errcode = '42501';
  end if;
  return query
  select date_trunc('month', l.entry_date)::date, 'income'::text,
         case when l.payer = 'agency' then 'agency_payments' else 'family_payments' end, round(sum(l.amount), 2)
    from daycare_ledger l
   where l.facility_id = p_facility and l.kind = 'payment' and l.voided_at is null
     and l.entry_date between p_from and p_to
   group by 1, 3
  union all
  select date_trunc('month', e.expense_date)::date, 'expense'::text, e.category, round(sum(e.amount), 2)
    from daycare_expenses e
   where e.facility_id = p_facility and e.expense_date between p_from and p_to
   group by 1, 3
   order by 1, 2, 3;
end $$;

-- Each child's attendance by day: first in, last out, minutes (each check-in paired with the
-- next check-out the same day; a missing check-out counts no minutes).
create or replace function public.daycare_attendance(p_facility uuid, p_from date, p_to date)
returns table (child_id uuid, child_name text, family_name text, classroom_name text, day date,
               first_in timestamptz, last_out timestamptz, minutes integer)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see attendance reports.' using errcode = '42501';
  end if;
  return query
  with ins as (
    select c.child_id as cid, c.checked_at as t_in, (c.checked_at at time zone 'America/Chicago')::date as d,
           (select co.checked_at from checkins co
             where co.facility_id = p_facility and co.child_id = c.child_id and co.status = 'out' and co.checked_at > c.checked_at
               and (co.checked_at at time zone 'America/Chicago')::date = (c.checked_at at time zone 'America/Chicago')::date
             order by co.checked_at limit 1) as t_out
      from checkins c
     where c.facility_id = p_facility and c.status = 'in'
       and (c.checked_at at time zone 'America/Chicago')::date between p_from and p_to
  )
  select ins.cid, coalesce(nullif(trim(ch.preferred_name), ''), ch.name), f.name,
         (select cl.name from facility_enrollments en join classrooms cl on cl.id = en.classroom_id
           where en.facility_id = p_facility and en.child_id = ins.cid order by (en.status = 'active') desc limit 1),
         ins.d, min(ins.t_in), max(ins.t_out),
         coalesce(round(sum(extract(epoch from (ins.t_out - ins.t_in)) / 60) filter (where ins.t_out is not null)), 0)::int
    from ins join children ch on ch.id = ins.cid left join families f on f.id = ch.family_id
   group by ins.cid, ch.preferred_name, ch.name, f.name, ins.d
   order by 2, 5;
end $$;

-- Each staff member's hours by day, from their room sign-ins (time outside a room isn't here)
create or replace function public.daycare_staff_hours(p_facility uuid, p_from date, p_to date)
returns table (staff_id uuid, staff_name text, role text, day date, minutes integer, still_open boolean)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see staff hours.' using errcode = '42501';
  end if;
  return query
  select s.id, coalesce(nullif(trim(s.name), ''), split_part(s.email, '@', 1)), s.role,
         (sh.started_at at time zone 'America/Chicago')::date,
         round(sum(extract(epoch from (coalesce(sh.ended_at, least(now(), sh.started_at + interval '16 hours')) - sh.started_at)) / 60))::int,
         bool_or(sh.ended_at is null)
    from classroom_shifts sh join facility_staff s on s.id = sh.staff_id
   where sh.facility_id = p_facility
     and (sh.started_at at time zone 'America/Chicago')::date between p_from and p_to
   group by s.id, s.name, s.email, s.role, 4
   order by 2, 4;
end $$;

-- ── Grants and schedule ──────────────────────────────────────────────────────
revoke all on public.daycare_expenses, public.daycare_recurring_expenses from anon;
revoke execute on function public.daycare_post_recurring_expenses(), public.daycare_receipt_ok(text),
  public.daycare_pnl(uuid, date, date), public.daycare_attendance(uuid, date, date),
  public.daycare_staff_hours(uuid, date, date) from anon, public;
grant execute on function public.daycare_receipt_ok(text), public.daycare_pnl(uuid, date, date),
  public.daycare_attendance(uuid, date, date), public.daycare_staff_hours(uuid, date, date) to authenticated;
grant execute on function public.daycare_post_recurring_expenses() to service_role;

select cron.schedule('daycare-recurring-expenses-daily', '5 12 * * *', $cron$ select public.daycare_post_recurring_expenses(); $cron$);
