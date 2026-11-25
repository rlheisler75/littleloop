-- Daycare phase 4C: online tuition payments with Stripe Connect.
-- Each daycare connects its OWN Stripe account (a standard account): the daycare is the seller,
-- Stripe charges the daycare its normal processing fees, and refunds and disputes are handled in the
-- daycare's Stripe dashboard. Parents pay by card or bank (ACH) on Stripe Checkout, created on the
-- daycare's account (a direct charge). littleloop's platform fee (fee_bps; 25 = 0.25%) is a Stripe
-- application fee on each payment. Money never passes through littleloop, and card or bank details
-- are entered only on Stripe's pages.
--   daycare_payment_accounts : the daycare's Stripe account and which ways to pay it takes. Written
--                              by the daycare-payments function (service role); managers switch card
--                              and bank on or off with daycare_set_payment_methods().
--   daycare_online_payments  : one row per checkout. The function keeps it in step with Stripe
--                              (return from checkout, webhook, hourly check); when it's paid,
--                              daycare_record_online_payment() puts the payment on the family's ledger
--                              once, and daycare_online_payment_refunded() follows refunds made in Stripe.

create table public.daycare_payment_accounts (
  facility_id       uuid primary key references public.facilities(id) on delete cascade,
  stripe_account_id text unique,
  test_mode         boolean not null default false,   -- Stripe test keys (demo daycares)
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  card_enabled      boolean not null default true,
  bank_enabled      boolean not null default true,
  bank_available    boolean not null default true,    -- false when the Stripe account can't take ACH yet
  fee_bps           integer not null default 25 check (fee_bps between 0 and 500),
  requirements      text,                              -- what Stripe still needs, for the director
  updated_at        timestamptz not null default now()
);
alter table public.daycare_payment_accounts enable row level security;
create policy "daycare_payment_accounts: managers read" on public.daycare_payment_accounts for select
  using (is_facility_manager(facility_id) or is_admin());
-- No client writes.

create or replace function public.daycare_set_payment_methods(p_facility uuid, p_card boolean, p_bank boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (is_facility_manager(p_facility) or is_admin()) then
    raise exception 'Only the director or office can change online payments.' using errcode = '42501';
  end if;
  update daycare_payment_accounts set card_enabled = coalesce(p_card, false), bank_enabled = coalesce(p_bank, false), updated_at = now()
   where facility_id = p_facility;
  if not found then raise exception 'Connect Stripe first.' using errcode = '22023'; end if;
end $$;

-- What a family (or staff) sees: can this daycare take payments online, and how
create or replace function public.daycare_online_pay_info(p_facility uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare a daycare_payment_accounts;
begin
  if not (is_facility_staff(p_facility) or is_admin()
          or exists (select 1 from facility_families ff where ff.facility_id = p_facility and ff.status = 'active' and is_family_parent(ff.family_id))) then
    return null;
  end if;
  select * into a from daycare_payment_accounts where facility_id = p_facility;
  if a.facility_id is null or a.stripe_account_id is null then return json_build_object('enabled', false); end if;
  return json_build_object(
    'enabled', a.charges_enabled and (a.card_enabled or (a.bank_enabled and a.bank_available)),
    'card', a.card_enabled, 'bank', a.bank_enabled and a.bank_available, 'test_mode', a.test_mode);
end $$;

create table public.daycare_online_payments (
  id                  uuid primary key default gen_random_uuid(),
  facility_id         uuid not null references public.facilities(id) on delete cascade,
  family_id           uuid not null references public.families(id) on delete cascade,
  amount              numeric(10,2) not null check (amount >= 1),
  fee                 numeric(10,2) not null default 0,          -- littleloop's platform fee
  status              text not null default 'started'
                        check (status in ('started', 'processing', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded')),
  method              text check (method in ('card', 'bank')),
  test_mode           boolean not null default false,
  stripe_account_id   text not null,
  checkout_session_id text unique,
  payment_intent_id   text,
  refunded_amount     numeric(10,2) not null default 0,
  disputed            boolean not null default false,
  ledger_id           uuid references public.daycare_ledger(id) on delete set null,
  failure_reason      text,
  paid_by             uuid references auth.users(id) on delete set null,
  paid_by_name        text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index daycare_online_payments_facility on public.daycare_online_payments (facility_id, created_at desc);
create index daycare_online_payments_family on public.daycare_online_payments (family_id, created_at desc);
create index daycare_online_payments_open on public.daycare_online_payments (status) where status in ('started', 'processing');
alter table public.daycare_online_payments enable row level security;
create policy "daycare_online_payments: managers or family read" on public.daycare_online_payments for select
  using (is_facility_manager(facility_id) or is_admin() or is_family_parent(family_id));
-- No client writes.

-- Ledger guard: entries made without a signed-in person can say who made them (littleloop.entry_by)
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
    new.created_by_name := coalesce(facility_staff_name(new.facility_id),
                                    case when auth.uid() is null then coalesce(nullif(current_setting('littleloop.entry_by', true), ''), 'Automatic billing') end);
    new.created_at := now();
    new.voided_at := null; new.voided_by_name := null; new.void_reason := null;
    if not v_rpc then new.statement_id := null; end if;
    return new;
  end if;
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Ledger entries are never deleted. Void it instead.' using errcode = '42501';
  end if;
  if not v_rpc then
    raise exception 'Ledger entries can''t be changed. Void it and add a corrected entry.' using errcode = '42501';
  end if;
  new.facility_id := old.facility_id; new.family_id := old.family_id; new.child_id := old.child_id;
  new.payer := old.payer; new.agency := old.agency; new.kind := old.kind; new.category := old.category;
  new.description := old.description; new.amount := old.amount; new.entry_date := old.entry_date;
  new.period_start := old.period_start; new.period_end := old.period_end; new.method := old.method;
  new.reference := old.reference; new.created_by := old.created_by; new.created_by_name := old.created_by_name;
  new.created_at := old.created_at;
  return new;
end $$;

-- A paid online payment goes on the family's ledger once (server only)
create or replace function public.daycare_record_online_payment(p_id uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare p daycare_online_payments; v_ledger uuid;
begin
  if is_client_request() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into p from daycare_online_payments where id = p_id for update;
  if p.id is null or p.status <> 'paid' then return null; end if;
  if p.ledger_id is not null then return p.ledger_id; end if;
  perform set_config('littleloop.entry_by', 'Online payment', true);
  insert into daycare_ledger (facility_id, family_id, payer, kind, category, description, amount, method, reference, entry_date)
  values (p.facility_id, p.family_id, 'family', 'payment', 'payment',
          case when p.method = 'bank' then 'Paid online from a bank account' else 'Paid online by card' end,
          p.amount, case when p.method = 'bank' then 'ach' else 'card' end,
          left(coalesce(p.payment_intent_id, p.checkout_session_id), 60),
          coalesce((p.paid_at at time zone 'America/Chicago')::date, daycare_today()))
  returning id into v_ledger;
  perform set_config('littleloop.entry_by', '', true);
  update daycare_online_payments set ledger_id = v_ledger, updated_at = now() where id = p_id;
  return v_ledger;
end $$;

-- A refund made in the daycare's Stripe dashboard (p_refunded = total refunded so far): the ledger
-- payment is voided and, after a partial refund, re-added for what was kept. That keeps the family's
-- balance and the profit and loss right.
create or replace function public.daycare_online_payment_refunded(p_id uuid, p_refunded numeric)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare p daycare_online_payments; l daycare_ledger; v_total numeric; v_net numeric; v_new uuid;
begin
  if is_client_request() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select * into p from daycare_online_payments where id = p_id for update;
  v_total := least(round(coalesce(p_refunded, 0), 2), p.amount);
  if p.id is null or v_total <= p.refunded_amount then return false; end if;
  v_net := p.amount - v_total;
  if p.ledger_id is not null then
    select * into l from daycare_ledger where id = p.ledger_id;
    perform set_config('littleloop.billing_rpc', 'on', true);
    update daycare_ledger set voided_at = now(), voided_by_name = 'Online payment',
           void_reason = 'Refunded in Stripe: ' || to_char(v_total, 'FM$999,999,990.00')
     where id = p.ledger_id and voided_at is null;
    perform set_config('littleloop.billing_rpc', 'off', true);
    if v_net > 0 then
      perform set_config('littleloop.entry_by', 'Online payment', true);
      insert into daycare_ledger (facility_id, family_id, payer, kind, category, description, amount, method, reference, entry_date)
      values (l.facility_id, l.family_id, 'family', 'payment', 'payment',
              left(l.description || ' (' || to_char(v_total, 'FM$999,999,990.00') || ' refunded)', 200),
              v_net, l.method, l.reference, l.entry_date)
      returning id into v_new;
      perform set_config('littleloop.entry_by', '', true);
    end if;
  end if;
  update daycare_online_payments
     set refunded_amount = v_total, status = case when v_net <= 0 then 'refunded' else 'partially_refunded' end,
         ledger_id = v_new, updated_at = now()
   where id = p_id;
  return true;
end $$;

revoke all on public.daycare_payment_accounts, public.daycare_online_payments from anon;
revoke execute on function public.daycare_set_payment_methods(uuid, boolean, boolean), public.daycare_online_pay_info(uuid),
  public.daycare_record_online_payment(uuid), public.daycare_online_payment_refunded(uuid, numeric) from anon, public;
grant execute on function public.daycare_set_payment_methods(uuid, boolean, boolean), public.daycare_online_pay_info(uuid) to authenticated;
grant execute on function public.daycare_record_online_payment(uuid), public.daycare_online_payment_refunded(uuid, numeric) to service_role;

-- Hourly: catch up on payments Stripe hasn't told us about (bank payments clear in about 4 business days)
select cron.schedule('daycare-online-payments-hourly', '17 * * * *', $cron$
  select net.http_post(
    url     := 'https://ukcxammnzhirxjdlqelr.supabase.co/functions/v1/daycare-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recurring_cron_secret')
    ),
    body    := '{"action":"reconcile"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
