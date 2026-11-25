-- Daycare phase 4A: tuition billing (money coming in).
--
--   daycare_billing_settings : per daycare. Weekly or monthly, how many days before a period
--                              its bill goes out, due days, sibling discount, payment
--                              instructions, legal name + tax ID (year-end statements), and
--                              whether bills go out automatically.
--   daycare_tuition_rates    : a default rate per classroom (per billing period).
--   daycare_tuition_plans    : each child's tuition: amount per period, own discount, sibling
--                              discount on/off, and a subsidy (an agency pays part).
--   daycare_ledger           : every charge, payment and credit, for the family or for an
--                              agency. Balance forward: payments reduce the balance, they aren't
--                              matched to bills. Never edited or deleted: void + a new entry.
--   daycare_statements       : one per family per period, made by daycare_billing_run(); it
--                              gathers every entry not yet on a statement.
--
-- Who: the director and office (is_facility_manager). Parents (admin/member) read their own
-- family's entries (family share only) and statements. Teachers see nothing here.

create or replace function public.is_family_parent(p_family uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from members where family_id = p_family and user_id = auth.uid()
                  and status = 'active' and role in ('admin', 'member'))
$$;

-- ── Settings ─────────────────────────────────────────────────────────────────
create table public.daycare_billing_settings (
  facility_id          uuid primary key references public.facilities(id) on delete cascade,
  cycle                text not null default 'weekly' check (cycle in ('weekly', 'monthly')),
  bill_days_before     smallint not null default 3 check (bill_days_before between 0 and 20),
  due_days             smallint not null default 3 check (due_days between 0 and 60),
  sibling_discount_pct numeric(5,2) not null default 0 check (sibling_discount_pct between 0 and 100),
  payment_instructions text check (char_length(payment_instructions) <= 1000),
  legal_name           text check (char_length(legal_name) <= 150),
  tax_id               text check (char_length(tax_id) <= 20),
  auto_send            boolean not null default false,
  next_period_start    date,
  updated_at           timestamptz not null default now()
);

create or replace function public.daycare_billing_settings_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rpc boolean := coalesce(current_setting('littleloop.billing_rpc', true), '') = 'on';
begin
  -- The next period moves only when billing runs (or the cycle changes)
  if tg_op = 'UPDATE' and not v_rpc then new.next_period_start := old.next_period_start; end if;
  if tg_op = 'INSERT' or new.cycle is distinct from old.cycle or new.next_period_start is null then
    new.next_period_start := case when new.cycle = 'weekly' then date_trunc('week', current_date)::date + 7
                                  else (date_trunc('month', current_date) + interval '1 month')::date end;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_daycare_billing_settings_stamp before insert or update on public.daycare_billing_settings
  for each row execute function public.daycare_billing_settings_stamp();

alter table public.daycare_billing_settings enable row level security;
create policy "daycare_billing_settings: managers" on public.daycare_billing_settings for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());

-- ── Rates and plans ──────────────────────────────────────────────────────────
create table public.daycare_tuition_rates (
  classroom_id uuid primary key references public.classrooms(id) on delete cascade,
  facility_id  uuid not null references public.facilities(id) on delete cascade,
  amount       numeric(10,2) not null check (amount >= 0),
  updated_at   timestamptz not null default now()
);
create table public.daycare_tuition_plans (
  id               uuid primary key default gen_random_uuid(),
  facility_id      uuid not null references public.facilities(id) on delete cascade,
  child_id         uuid not null references public.children(id) on delete cascade,
  amount           numeric(10,2) not null check (amount >= 0),          -- per billing period
  discount_pct     numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  sibling_discount boolean not null default true,
  subsidy_amount   numeric(10,2) not null default 0 check (subsidy_amount >= 0),
  subsidy_agency   text check (char_length(subsidy_agency) <= 120),
  active           boolean not null default true,
  note             text check (char_length(note) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (facility_id, child_id),
  constraint daycare_plan_subsidy_agency check (subsidy_amount = 0 or char_length(trim(coalesce(subsidy_agency, ''))) > 0)
);

create or replace function public.daycare_rates_plans_check()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_table_name = 'daycare_tuition_rates' then
    if not exists (select 1 from classrooms where id = new.classroom_id and facility_id = new.facility_id) then
      raise exception 'That classroom belongs to another daycare.' using errcode = '42501';
    end if;
  else
    if tg_op = 'UPDATE' then new.facility_id := old.facility_id; new.child_id := old.child_id; new.created_at := old.created_at;
    elsif not exists (select 1 from facility_enrollments where facility_id = new.facility_id and child_id = new.child_id) then
      raise exception 'That child isn''t enrolled here.' using errcode = '42501';
    end if;
    if new.subsidy_amount = 0 then new.subsidy_agency := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_daycare_rates_check before insert or update on public.daycare_tuition_rates
  for each row execute function public.daycare_rates_plans_check();
create trigger trg_daycare_plans_check before insert or update on public.daycare_tuition_plans
  for each row execute function public.daycare_rates_plans_check();

alter table public.daycare_tuition_rates enable row level security;
create policy "daycare_tuition_rates: managers" on public.daycare_tuition_rates for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());
alter table public.daycare_tuition_plans enable row level security;
create policy "daycare_tuition_plans: managers" on public.daycare_tuition_plans for all
  using (is_facility_manager(facility_id) or is_admin()) with check (is_facility_manager(facility_id) or is_admin());

-- ── Statements and the ledger ────────────────────────────────────────────────
create table public.daycare_statements (
  id               uuid primary key default gen_random_uuid(),
  facility_id      uuid not null references public.facilities(id) on delete cascade,
  family_id        uuid not null references public.families(id) on delete cascade,
  number           integer not null,
  statement_date   date not null default current_date,
  due_date         date not null,
  period_start     date,
  period_end       date,
  previous_balance numeric(10,2) not null default 0,
  new_charges      numeric(10,2) not null default 0,
  payments_credits numeric(10,2) not null default 0,
  balance_due      numeric(10,2) not null default 0,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  unique (facility_id, number)
);
create unique index daycare_statements_one_per_period on public.daycare_statements (facility_id, family_id, period_start)
  where period_start is not null;
create index daycare_statements_family on public.daycare_statements (family_id, statement_date desc);

create table public.daycare_ledger (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  family_id       uuid not null references public.families(id) on delete cascade,
  child_id        uuid references public.children(id) on delete set null,
  payer           text not null default 'family' check (payer in ('family', 'agency')),
  agency          text check (char_length(agency) <= 120),
  kind            text not null check (kind in ('charge', 'payment', 'credit')),
  category        text not null default 'other'
                  check (category in ('tuition','registration','late_pickup','late_fee','supplies','activity','other','payment','credit')),
  description     text check (char_length(description) <= 200),
  amount          numeric(10,2) not null check (amount > 0),
  entry_date      date not null default current_date,
  period_start    date,
  period_end      date,
  method          text check (method in ('cash','check','card','ach','money_order','other')),
  reference       text check (char_length(reference) <= 60),
  statement_id    uuid references public.daycare_statements(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by_name  text,
  void_reason     text check (char_length(void_reason) <= 300),
  constraint daycare_ledger_agency check (payer = 'family' or char_length(trim(coalesce(agency, ''))) > 0)
);
create index daycare_ledger_family on public.daycare_ledger (facility_id, family_id, entry_date);
create index daycare_ledger_statement on public.daycare_ledger (statement_id);
-- Tuition for a child and period is billed once (per payer)
create unique index daycare_ledger_tuition_once on public.daycare_ledger (facility_id, child_id, period_start, payer)
  where category = 'tuition' and voided_at is null and period_start is not null;

create or replace function public.daycare_ledger_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rpc boolean := coalesce(current_setting('littleloop.billing_rpc', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from facility_families where facility_id = new.facility_id and family_id = new.family_id) then
      raise exception 'That family isn''t connected to this daycare.' using errcode = '42501';
    end if;
    if new.child_id is not null and not exists (select 1 from children where id = new.child_id and family_id = new.family_id) then
      raise exception 'That child isn''t in this family.' using errcode = '22023';
    end if;
    if new.kind = 'payment' then
      new.category := 'payment';
      if new.method is null then raise exception 'Choose how it was paid.' using errcode = '22023'; end if;
    elsif new.kind = 'credit' then
      new.category := 'credit'; new.method := null;
    else
      if new.category in ('payment', 'credit') then new.category := 'other'; end if;
      new.method := null;
    end if;
    if new.payer = 'family' then new.agency := null; end if;
    if new.entry_date > current_date + 31 then raise exception 'That date is too far ahead.' using errcode = '22023'; end if;
    new.amount := round(new.amount, 2);
    new.created_by := auth.uid();
    new.created_by_name := coalesce(facility_staff_name(new.facility_id), case when auth.uid() is null then 'Automatic billing' end);
    new.created_at := now();
    new.voided_at := null; new.voided_by_name := null; new.void_reason := null;
    if not v_rpc then new.statement_id := null; end if;
    return new;
  end if;
  -- Foreign-key clean-up (a deleted family, child, statement or daycare) passes through
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Ledger entries are never deleted. Void it instead.' using errcode = '42501';
  end if;
  if not v_rpc then
    raise exception 'Ledger entries can''t be changed. Void it and add a corrected entry.' using errcode = '42501';
  end if;
  -- Billing functions only set the statement and the void fields
  new.facility_id := old.facility_id; new.family_id := old.family_id; new.child_id := old.child_id;
  new.payer := old.payer; new.agency := old.agency; new.kind := old.kind; new.category := old.category;
  new.description := old.description; new.amount := old.amount; new.entry_date := old.entry_date;
  new.period_start := old.period_start; new.period_end := old.period_end; new.method := old.method;
  new.reference := old.reference; new.created_by := old.created_by; new.created_by_name := old.created_by_name;
  new.created_at := old.created_at;
  return new;
end $$;
create trigger trg_daycare_ledger_guard before insert or update or delete on public.daycare_ledger
  for each row execute function public.daycare_ledger_guard();

alter table public.daycare_ledger enable row level security;
create policy "daycare_ledger: read" on public.daycare_ledger for select
  using (is_facility_manager(facility_id) or (payer = 'family' and is_family_parent(family_id)) or is_admin());
create policy "daycare_ledger: managers add" on public.daycare_ledger for insert
  with check (is_facility_manager(facility_id) or is_admin());
-- No update/delete policies: voids and statements go through the functions below.

alter table public.daycare_statements enable row level security;
create policy "daycare_statements: read" on public.daycare_statements for select
  using (is_facility_manager(facility_id) or is_family_parent(family_id) or is_admin());
-- Written only by daycare_billing_run().

-- ── Billing run (preview or create) ──────────────────────────────────────────
create or replace function public.daycare_billing_run(p_facility uuid, p_period_start date, p_commit boolean default false)
returns json language plpgsql security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  s daycare_billing_settings; v_end date; v_sib numeric; fam record; c record; v_fac text; v_staff text;
  v_rank int; v_disc numeric; v_agency numeric; v_family numeric; v_exists boolean;
  v_kids jsonb; v_tuition numeric; v_other numeric; v_pay numeric; v_bal numeric; v_prev numeric;
  v_has boolean; v_stmt uuid; v_num int;
  v_out jsonb := '[]'::jsonb; v_created jsonb := '[]'::jsonb;
begin
  if is_client_request() and not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can run billing.' using errcode = '42501';
  end if;
  if p_period_start is null then raise exception 'Choose the period to bill.' using errcode = '22023'; end if;
  select * into s from daycare_billing_settings where facility_id = p_facility;
  if s.facility_id is null then   -- two first-time previews can race: insert once, then read
    insert into daycare_billing_settings (facility_id) values (p_facility) on conflict (facility_id) do nothing;
    select * into s from daycare_billing_settings where facility_id = p_facility;
  end if;
  if s.cycle = 'weekly' and extract(isodow from p_period_start) <> 1 then
    raise exception 'Weekly billing periods start on a Monday.' using errcode = '22023';
  end if;
  if p_period_start > current_date + 62 or p_period_start < current_date - 62 then
    raise exception 'Pick a period within two months of today.' using errcode = '22023';
  end if;
  v_end := case when s.cycle = 'weekly' then p_period_start + 6
                else (p_period_start + interval '1 month' - interval '1 day')::date end;
  v_sib := coalesce(s.sibling_discount_pct, 0);
  select name into v_fac from facilities where id = p_facility;
  v_staff := coalesce(facility_staff_name(p_facility), 'Automatic billing');
  if p_commit then
    perform pg_advisory_xact_lock(hashtext('daycare_billing:' || p_facility::text));
    perform set_config('littleloop.billing_rpc', 'on', true);
  end if;

  for fam in
    select f.id, f.name from facility_families ff join families f on f.id = ff.family_id
     where ff.facility_id = p_facility and ff.status in ('active', 'pending') order by f.name   -- pending = no parent login yet (the office prints or emails the bill)
  loop
    v_kids := '[]'::jsonb; v_tuition := 0; v_rank := 0;
    for c in
      select p.child_id, p.amount, p.discount_pct, p.sibling_discount, p.subsidy_amount, p.subsidy_agency,
             coalesce(nullif(trim(ch.preferred_name), ''), ch.name) as child_name
        from daycare_tuition_plans p
        join children ch on ch.id = p.child_id
        join facility_enrollments e on e.facility_id = p.facility_id and e.child_id = p.child_id and e.status = 'active'
       where p.facility_id = p_facility and ch.family_id = fam.id and p.active
       order by p.amount desc, ch.name
    loop
      v_rank := v_rank + 1;
      v_disc := round(c.amount * (1 - c.discount_pct / 100)
                      * (case when v_rank > 1 and c.sibling_discount then 1 - v_sib / 100 else 1 end), 2);
      v_agency := least(c.subsidy_amount, v_disc);
      v_family := v_disc - v_agency;
      v_exists := exists (select 1 from daycare_ledger l where l.facility_id = p_facility and l.child_id = c.child_id
                            and l.period_start = p_period_start and l.category = 'tuition' and l.voided_at is null);
      v_kids := v_kids || jsonb_build_object('child_id', c.child_id, 'name', c.child_name, 'tuition', c.amount,
                  'after_discounts', v_disc, 'agency', v_agency, 'agency_name', c.subsidy_agency, 'family', v_family,
                  'sibling', v_rank > 1 and c.sibling_discount and v_sib > 0, 'already_billed', v_exists);
      if not v_exists then
        v_tuition := v_tuition + v_family;
        if p_commit then
          if v_family > 0 then
            insert into daycare_ledger (facility_id, family_id, child_id, payer, kind, category, description, amount, entry_date, period_start, period_end)
            values (p_facility, fam.id, c.child_id, 'family', 'charge', 'tuition', 'Tuition: ' || c.child_name, v_family, current_date, p_period_start, v_end);
          end if;
          if v_agency > 0 then
            insert into daycare_ledger (facility_id, family_id, child_id, payer, agency, kind, category, description, amount, entry_date, period_start, period_end)
            values (p_facility, fam.id, c.child_id, 'agency', c.subsidy_agency, 'charge', 'tuition', 'Tuition (subsidy): ' || c.child_name, v_agency, current_date, p_period_start, v_end);
          end if;
        end if;
      end if;
    end loop;

    -- Family entries not on a statement yet (after a commit this includes the new tuition)
    select coalesce(sum(l.amount) filter (where l.kind = 'charge'), 0), coalesce(sum(l.amount) filter (where l.kind <> 'charge'), 0)
      into v_other, v_pay
      from daycare_ledger l
     where l.facility_id = p_facility and l.family_id = fam.id and l.payer = 'family' and l.voided_at is null and l.statement_id is null;
    if p_commit then v_other := v_other - v_tuition; end if;
    select coalesce(sum(case when l.kind = 'charge' then l.amount else -l.amount end), 0) into v_bal
      from daycare_ledger l where l.facility_id = p_facility and l.family_id = fam.id and l.payer = 'family' and l.voided_at is null;
    if not p_commit then v_bal := v_bal + v_tuition; end if;
    v_prev := v_bal - (v_tuition + v_other) + v_pay;
    v_has := exists (select 1 from daycare_statements st where st.facility_id = p_facility and st.family_id = fam.id and st.period_start = p_period_start);

    if jsonb_array_length(v_kids) = 0 and v_other = 0 and v_pay = 0 and v_bal = 0 then continue; end if;   -- nothing to bill

    v_stmt := null;
    if p_commit and not v_has then
      select coalesce(max(number), 0) + 1 into v_num from daycare_statements where facility_id = p_facility;
      insert into daycare_statements (facility_id, family_id, number, statement_date, due_date, period_start, period_end,
                                      previous_balance, new_charges, payments_credits, balance_due, created_by_name)
      values (p_facility, fam.id, v_num, current_date, current_date + s.due_days, p_period_start, v_end,
              v_prev, v_tuition + v_other, v_pay, v_bal, v_staff)
      returning id into v_stmt;
      update daycare_ledger l set statement_id = v_stmt
       where l.facility_id = p_facility and l.family_id = fam.id and l.payer = 'family' and l.voided_at is null and l.statement_id is null;
      insert into notifications (user_id, type, title, body, read, data)
      select distinct m.user_id, 'daycare_statement', 'Statement from ' || coalesce(v_fac, 'your daycare'),
             case when v_bal > 0 then 'Balance due ' || to_char(v_bal, 'FM$999,999,990.00') || ' by ' || to_char(current_date + s.due_days, 'Mon FMDD')
                  else 'Your account is paid up. Thank you!' end,
             false, jsonb_build_object('facility_id', p_facility, 'statement_id', v_stmt)
        from members m where m.family_id = fam.id and m.status = 'active' and m.role in ('admin', 'member') and m.user_id is not null;
      v_created := v_created || to_jsonb(v_stmt);
    end if;

    v_out := v_out || jsonb_build_object('family_id', fam.id, 'family_name', fam.name, 'children', v_kids,
               'tuition', v_tuition, 'other_charges', v_other, 'payments_credits', v_pay,
               'previous_balance', v_prev, 'balance_due', v_bal, 'has_statement', v_has, 'statement_id', v_stmt);
  end loop;

  if p_commit then
    if s.next_period_start is null or p_period_start >= s.next_period_start then
      update daycare_billing_settings set next_period_start = v_end + 1 where facility_id = p_facility;
    end if;
    perform set_config('littleloop.billing_rpc', 'off', true);
  end if;
  return json_build_object('period_start', p_period_start, 'period_end', v_end, 'cycle', s.cycle,
                           'families', v_out, 'created', v_created);
end $$;

-- Automatic billing (pg_cron, through the daycare-billing function): every daycare with
-- auto_send whose next period's bill day has come, while it's on a plan or in its trial.
create or replace function public.daycare_run_due_billing()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; v jsonb := '[]'::jsonb; res json;
begin
  if is_client_request() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  for r in
    select bs.facility_id, bs.next_period_start from daycare_billing_settings bs
     where bs.auto_send and bs.next_period_start is not null
       and bs.next_period_start - bs.bill_days_before <= current_date
       and facility_in_good_standing(bs.facility_id)
  loop
    begin
      res := daycare_billing_run(r.facility_id, r.next_period_start, true);
      v := v || jsonb_build_object('facility_id', r.facility_id, 'created', res->'created');
    exception when others then
      v := v || jsonb_build_object('facility_id', r.facility_id, 'error', sqlerrm);
    end;
  end loop;
  return v;
end $$;

-- ── Corrections and reports ──────────────────────────────────────────────────
create or replace function public.daycare_void_entry(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r daycare_ledger;
begin
  select * into r from daycare_ledger where id = p_id;
  if r.id is null or not (is_facility_manager(r.facility_id) or is_admin()) then
    raise exception 'Only the director or office can void an entry.' using errcode = '42501';
  end if;
  if r.voided_at is not null then raise exception 'This entry is already voided.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Say why it''s being voided.' using errcode = '22023'; end if;
  perform set_config('littleloop.billing_rpc', 'on', true);
  update daycare_ledger set voided_at = now(), voided_by_name = facility_staff_name(r.facility_id), void_reason = left(trim(p_reason), 300)
   where id = p_id;
  perform set_config('littleloop.billing_rpc', 'off', true);
end $$;

-- Each connected (or once-connected) family: balance, past due (charges older than the due
-- days that payments haven't covered, oldest first), and the last payment.
create or replace function public.daycare_accounts(p_facility uuid)
returns table (family_id uuid, family_name text, connected boolean, balance numeric, past_due numeric,
               oldest_unpaid date, last_payment_date date, last_payment_amount numeric, statements integer)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare v_due int;
begin
  if is_client_request() and not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see accounts.' using errcode = '42501';
  end if;
  select bs.due_days into v_due from daycare_billing_settings bs where bs.facility_id = p_facility;
  v_due := coalesce(v_due, 3);
  return query
  with fams as (
    select ff.family_id as fid, f.name as fname, ff.status in ('active', 'pending') as conn
      from facility_families ff join families f on f.id = ff.family_id where ff.facility_id = p_facility
  ), e as (
    select l.family_id as fid, l.kind, l.amount, l.entry_date, l.created_at, l.id
      from daycare_ledger l where l.facility_id = p_facility and l.payer = 'family' and l.voided_at is null
  ), tot as (
    select e.fid, coalesce(sum(e.amount) filter (where e.kind = 'charge'), 0) as charged,
           coalesce(sum(e.amount) filter (where e.kind <> 'charge'), 0) as paid
      from e group by e.fid
  ), ch as (
    select e.fid, e.entry_date, e.amount,
           sum(e.amount) over (partition by e.fid order by e.entry_date, e.created_at, e.id) as cum
      from e where e.kind = 'charge'
  ), open_ch as (
    select ch.fid, ch.entry_date, greatest(0, least(ch.amount, ch.cum - coalesce(t.paid, 0))) as open_amt
      from ch left join tot t on t.fid = ch.fid
  ), lastpay as (
    select distinct on (e.fid) e.fid, e.entry_date, e.amount from e where e.kind = 'payment'
     order by e.fid, e.entry_date desc, e.created_at desc
  )
  select fams.fid, fams.fname, fams.conn,
         round(coalesce(t.charged, 0) - coalesce(t.paid, 0), 2),
         round(coalesce((select sum(o.open_amt) from open_ch o where o.fid = fams.fid and o.entry_date + v_due < current_date), 0), 2),
         (select min(o.entry_date) from open_ch o where o.fid = fams.fid and o.open_amt > 0),
         lp.entry_date, lp.amount,
         (select count(*)::int from daycare_statements st where st.facility_id = p_facility and st.family_id = fams.fid)
    from fams left join tot t on t.fid = fams.fid left join lastpay lp on lp.fid = fams.fid
   where fams.conn or coalesce(t.charged, 0) - coalesce(t.paid, 0) <> 0
   order by fams.fname;
end $$;

create or replace function public.daycare_agency_balances(p_facility uuid)
returns table (agency text, charged numeric, paid numeric, balance numeric, last_payment date)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if is_client_request() and not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see agency accounts.' using errcode = '42501';
  end if;
  return query
  select l.agency, round(coalesce(sum(l.amount) filter (where l.kind = 'charge'), 0), 2),
         round(coalesce(sum(l.amount) filter (where l.kind <> 'charge'), 0), 2),
         round(coalesce(sum(case when l.kind = 'charge' then l.amount else -l.amount end), 0), 2),
         max(l.entry_date) filter (where l.kind = 'payment')
    from daycare_ledger l
   where l.facility_id = p_facility and l.payer = 'agency' and l.voided_at is null
   group by l.agency order by l.agency;
end $$;

-- What a parent's statements screen needs from the daycare (no tax ID)
create or replace function public.daycare_billing_info(p_facility uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (is_facility_staff(p_facility) or is_facility_family_member(p_facility) or is_admin()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return (select json_build_object('name', coalesce(nullif(trim(bs.legal_name), ''), f.name), 'dba', f.name,
                                   'phone', f.phone, 'email', f.email,
                                   'address', concat_ws(', ', nullif(f.address_line1, ''), nullif(f.city, ''), nullif(concat_ws(' ', f.state, f.zip), '')),
                                   'payment_instructions', bs.payment_instructions, 'cycle', coalesce(bs.cycle, 'weekly'))
            from facilities f left join daycare_billing_settings bs on bs.facility_id = f.id where f.id = p_facility);
end $$;

-- Year-end statement of childcare paid (for the child and dependent care credit / FSA)
create or replace function public.daycare_tax_statement(p_facility uuid, p_family uuid, p_year integer)
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (is_facility_manager(p_facility) or is_family_parent(p_family) or is_admin()) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return json_build_object(
    'year', p_year,
    'provider', (select json_build_object('name', coalesce(nullif(trim(bs.legal_name), ''), f.name), 'dba', f.name,
                   'address', concat_ws(', ', nullif(f.address_line1, ''), nullif(f.city, ''), nullif(concat_ws(' ', f.state, f.zip), '')),
                   'phone', f.phone, 'tax_id', bs.tax_id, 'license', f.license_number)
                 from facilities f left join daycare_billing_settings bs on bs.facility_id = f.id where f.id = p_facility),
    'family', (select name from families where id = p_family),
    'children', (select coalesce(json_agg(distinct coalesce(nullif(trim(ch.preferred_name), ''), ch.name)), '[]'::json)
                   from daycare_ledger l join children ch on ch.id = l.child_id
                  where l.facility_id = p_facility and l.family_id = p_family and l.kind = 'charge' and l.voided_at is null
                    and extract(year from l.entry_date) = p_year),
    'total_paid', (select coalesce(sum(l.amount), 0) from daycare_ledger l
                    where l.facility_id = p_facility and l.family_id = p_family and l.payer = 'family' and l.kind = 'payment'
                      and l.voided_at is null and extract(year from l.entry_date) = p_year),
    'payments', (select count(*) from daycare_ledger l
                  where l.facility_id = p_facility and l.family_id = p_family and l.payer = 'family' and l.kind = 'payment'
                    and l.voided_at is null and extract(year from l.entry_date) = p_year));
end $$;

create or replace function public.daycare_tax_summary(p_facility uuid, p_year integer)
returns table (family_id uuid, family_name text, total_paid numeric, payments integer)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can see this.' using errcode = '42501';
  end if;
  return query
  select f.id, f.name, round(sum(l.amount), 2), count(*)::int
    from daycare_ledger l join families f on f.id = l.family_id
   where l.facility_id = p_facility and l.payer = 'family' and l.kind = 'payment' and l.voided_at is null
     and extract(year from l.entry_date) = p_year
   group by f.id, f.name order by f.name;
end $$;

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke all on public.daycare_billing_settings, public.daycare_tuition_rates, public.daycare_tuition_plans,
              public.daycare_statements, public.daycare_ledger from anon;
revoke execute on function public.is_family_parent(uuid), public.daycare_billing_run(uuid, date, boolean),
  public.daycare_run_due_billing(), public.daycare_void_entry(uuid, text), public.daycare_accounts(uuid),
  public.daycare_agency_balances(uuid), public.daycare_billing_info(uuid), public.daycare_tax_statement(uuid, uuid, integer),
  public.daycare_tax_summary(uuid, integer) from anon, public;
grant execute on function public.is_family_parent(uuid), public.daycare_billing_run(uuid, date, boolean),
  public.daycare_void_entry(uuid, text), public.daycare_accounts(uuid), public.daycare_agency_balances(uuid),
  public.daycare_billing_info(uuid), public.daycare_tax_statement(uuid, uuid, integer),
  public.daycare_tax_summary(uuid, integer) to authenticated;
grant execute on function public.daycare_run_due_billing() to service_role;

-- ── Automatic billing, daily at 12:00 UTC (6 AM Central) ─────────────────────
-- Calls the daycare-billing function (run_due), which runs daycare_run_due_billing() and
-- emails / pushes the new statements. Same cron secret as recurring invoices.
select cron.schedule('daycare-billing-daily', '0 12 * * *', $cron$
  select net.http_post(
    url     := 'https://ukcxammnzhirxjdlqelr.supabase.co/functions/v1/daycare-billing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recurring_cron_secret')
    ),
    body    := '{"action":"run_due"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
