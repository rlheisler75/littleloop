-- Billing dates in US Central time instead of UTC (see 20261125_daycare_billing_4a.sql).

-- Billing dates are the daycare's calendar day (US Central, like recurring invoices), not UTC:
-- after 6 PM Central, UTC is already tomorrow.
create or replace function public.daycare_today()
returns date language sql stable as $$ select (now() at time zone 'America/Chicago')::date $$;

alter table public.daycare_statements alter column statement_date set default daycare_today();

alter table public.daycare_ledger alter column entry_date set default daycare_today();

create or replace function public.daycare_billing_settings_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_rpc boolean := coalesce(current_setting('littleloop.billing_rpc', true), '') = 'on';
begin
  -- The next period moves only when billing runs (or the cycle changes)
  if tg_op = 'UPDATE' and not v_rpc then new.next_period_start := old.next_period_start; end if;
  if tg_op = 'INSERT' or new.cycle is distinct from old.cycle or new.next_period_start is null then
    new.next_period_start := case when new.cycle = 'weekly' then date_trunc('week', daycare_today())::date + 7
                                  else (date_trunc('month', daycare_today()) + interval '1 month')::date end;
  end if;
  new.updated_at := now();
  return new;
end $$;


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
    if new.entry_date > daycare_today() + 31 then raise exception 'That date is too far ahead.' using errcode = '22023'; end if;
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
  if p_period_start > daycare_today() + 62 or p_period_start < daycare_today() - 62 then
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
            values (p_facility, fam.id, c.child_id, 'family', 'charge', 'tuition', 'Tuition: ' || c.child_name, v_family, daycare_today(), p_period_start, v_end);
          end if;
          if v_agency > 0 then
            insert into daycare_ledger (facility_id, family_id, child_id, payer, agency, kind, category, description, amount, entry_date, period_start, period_end)
            values (p_facility, fam.id, c.child_id, 'agency', c.subsidy_agency, 'charge', 'tuition', 'Tuition (subsidy): ' || c.child_name, v_agency, daycare_today(), p_period_start, v_end);
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
      values (p_facility, fam.id, v_num, daycare_today(), daycare_today() + s.due_days, p_period_start, v_end,
              v_prev, v_tuition + v_other, v_pay, v_bal, v_staff)
      returning id into v_stmt;
      update daycare_ledger l set statement_id = v_stmt
       where l.facility_id = p_facility and l.family_id = fam.id and l.payer = 'family' and l.voided_at is null and l.statement_id is null;
      insert into notifications (user_id, type, title, body, read, data)
      select distinct m.user_id, 'daycare_statement', 'Statement from ' || coalesce(v_fac, 'your daycare'),
             case when v_bal > 0 then 'Balance due ' || to_char(v_bal, 'FM$999,999,990.00') || ' by ' || to_char(daycare_today() + s.due_days, 'Mon FMDD')
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


create or replace function public.daycare_run_due_billing()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; v jsonb := '[]'::jsonb; res json;
begin
  if is_client_request() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  for r in
    select bs.facility_id, bs.next_period_start from daycare_billing_settings bs
     where bs.auto_send and bs.next_period_start is not null
       and bs.next_period_start - bs.bill_days_before <= daycare_today()
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
         round(coalesce((select sum(o.open_amt) from open_ch o where o.fid = fams.fid and o.entry_date + v_due < daycare_today()), 0), 2),
         (select min(o.entry_date) from open_ch o where o.fid = fams.fid and o.open_amt > 0),
         lp.entry_date, lp.amount,
         (select count(*)::int from daycare_statements st where st.facility_id = p_facility and st.family_id = fams.fid)
    from fams left join tot t on t.fid = fams.fid left join lastpay lp on lp.fid = fams.fid
   where fams.conn or coalesce(t.charged, 0) - coalesce(t.paid, 0) <> 0
   order by fams.fname;
end $$;


grant execute on function public.daycare_today() to authenticated, service_role;
