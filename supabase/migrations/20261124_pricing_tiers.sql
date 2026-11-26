-- Pricing (2026-11-24): child-based tiers for sitters and daycares.
--
--   Sitters  : Free up to 3 children; $7 up to 10 (s10); $12 up to 20 (s20); $20 unlimited.
--              Yearly = 10x monthly. Complimentary plans (free_founder, grandfathered) stay
--              unlimited. Daycare staff get sitter mode free and unlimited while they are
--              active staff at a daycare in good standing (paid, in trial, or complimentary).
--              Children = children in the families the sitter is connected to (active/pending).
--   Daycares : 30-day free trial (no card, no child cap); then Home up to 12 children ($29),
--              Center up to 60 ($79), Large unlimited ($149); yearly = 10x monthly.
--              Children = active enrollments.
-- Limits only block ADDING a family (sitters) or enrolling a child (daycares); nobody is
-- locked out of what they already have. Daycare staff screens show a "choose a plan" wall
-- once the trial is over without a plan (app side, facility_plan_summary()).
-- Billing state is written only by the billing Edge Function (service role).

-- ── Sitters ──────────────────────────────────────────────────────────────────
alter table public.sitters add column if not exists plan_tier text
  check (plan_tier in ('s10', 's20', 'unlimited'));

create or replace function public.guard_sitter_billing_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_client_request() or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.subscription_plan      := null;
    new.subscription_status    := null;
    new.stripe_customer_id     := null;
    new.stripe_subscription_id := null;
    new.trial_ends_at          := null;
    new.current_period_end     := null;
    new.plan_tier              := null;
    return new;
  end if;
  if new.subscription_plan      is distinct from old.subscription_plan
  or new.subscription_status    is distinct from old.subscription_status
  or new.stripe_customer_id     is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id
  or new.trial_ends_at          is distinct from old.trial_ends_at
  or new.current_period_end     is distinct from old.current_period_end
  or new.plan_tier              is distinct from old.plan_tier then
    raise exception 'Billing fields can only be changed through billing.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ── Daycare billing (one row per daycare; managers read it, only billing writes it) ──
create table public.facility_billing (
  facility_id            uuid primary key references public.facilities(id) on delete cascade,
  plan_tier              text check (plan_tier in ('home', 'center', 'large')),
  plan_interval          text check (plan_interval in ('month', 'year')),
  subscription_status    text,
  trial_ends_at          timestamptz not null default (now() + interval '30 days'),
  current_period_end     timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  complimentary          boolean not null default false,
  updated_at             timestamptz not null default now()
);
alter table public.facility_billing enable row level security;
create policy "facility_billing: managers read" on public.facility_billing for select
  using (is_facility_manager(facility_id) or is_admin());
-- No insert/update/delete policies: written by triggers and the billing function only.
revoke all on public.facility_billing from anon;

insert into public.facility_billing (facility_id, trial_ends_at)
select id, greatest(created_at + interval '30 days', now() + interval '7 days') from public.facilities
on conflict (facility_id) do nothing;
-- The demo daycare never expires
update public.facility_billing set complimentary = true where facility_id = '0a89a951-07d3-4794-a7dc-39d5ff8c2030';

create or replace function public.facility_billing_seed()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into facility_billing (facility_id) values (new.id) on conflict (facility_id) do nothing;
  return new;
end $$;
create trigger trg_facility_billing_seed after insert on public.facilities
  for each row execute function public.facility_billing_seed();

-- Paid, in trial, or complimentary. past_due keeps working while Stripe retries the card.
create or replace function public.facility_in_good_standing(p_facility_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select b.complimentary
        or b.subscription_status in ('active', 'trialing', 'past_due')
        or b.trial_ends_at > now()
      from facility_billing b where b.facility_id = p_facility_id), false)
$$;

-- Children a daycare may have enrolled: null = no cap (trial, Large, complimentary)
create or replace function public.facility_child_limit(p_facility_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select case
    when b.complimentary then null
    when b.subscription_status in ('active', 'trialing', 'past_due')
      then case b.plan_tier when 'home' then 12 when 'center' then 60 else null end
    when b.trial_ends_at > now() then null
    else 0 end
    from facility_billing b where b.facility_id = p_facility_id
$$;

-- What any staff member's screens need (no Stripe ids)
create or replace function public.facility_plan_summary(p_facility_id uuid)
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare b facility_billing; v_count int;
begin
  if not (is_facility_staff(p_facility_id) or is_admin()) then
    raise exception 'Only this daycare''s staff can see its plan.' using errcode = '42501';
  end if;
  select * into b from facility_billing where facility_id = p_facility_id;
  select count(*) into v_count from facility_enrollments where facility_id = p_facility_id and status = 'active';
  return json_build_object(
    'tier', b.plan_tier, 'interval', b.plan_interval, 'status', b.subscription_status,
    'trial_ends_at', b.trial_ends_at, 'current_period_end', b.current_period_end,
    'complimentary', coalesce(b.complimentary, false),
    'in_trial', b.subscription_status is null and b.trial_ends_at > now() and not coalesce(b.complimentary, false),
    'good_standing', facility_in_good_standing(p_facility_id),
    'limit', facility_child_limit(p_facility_id), 'children', v_count,
    'has_billing', b.stripe_customer_id is not null);
end $$;

-- Enrollment cap: blocks enrolling past the plan (or after the trial without a plan)
create or replace function public.enforce_facility_child_limit()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_limit int; v_count int;
begin
  if new.status <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'active' then return new; end if;   -- room changes etc.
  if not is_client_request() or is_admin() then return new; end if;
  if not facility_in_good_standing(new.facility_id) then
    raise exception 'TRIAL_ENDED: Your free trial has ended. Choose a plan under Center to keep enrolling children.' using errcode = 'P0001';
  end if;
  v_limit := facility_child_limit(new.facility_id);
  if v_limit is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('facility_child_limit:' || new.facility_id::text));
  select count(*) into v_count from facility_enrollments
   where facility_id = new.facility_id and status = 'active' and id <> new.id;
  if v_count >= v_limit then
    raise exception 'PLAN_CHILD_LIMIT: Your plan covers % children. Move to a bigger plan under Center to enroll more.', v_limit using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_facility_child_limit before insert or update of status on public.facility_enrollments
  for each row execute function public.enforce_facility_child_limit();

-- ── Sitter limits ────────────────────────────────────────────────────────────
-- Active staff at a daycare in good standing: sitter mode is free and unlimited
create or replace function public.sitter_staff_perk(p_user uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from facility_staff s
                  where s.user_id = p_user and s.status = 'active' and facility_in_good_standing(s.facility_id))
$$;

-- Paid features (recurring invoices): any paid tier, complimentary, or the staff perk
create or replace function public.sitter_is_pro(p_sitter_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from sitters
    where id = p_sitter_id
      and (subscription_status in ('active', 'trialing', 'past_due')
           or subscription_plan in ('free_founder', 'grandfathered'))
  ) or sitter_staff_perk(p_sitter_id);
$$;

-- Children a sitter may care for: null = unlimited
create or replace function public.sitter_child_limit(p_sitter_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select case
    when s.subscription_plan in ('free_founder', 'grandfathered') then null
    when sitter_staff_perk(p_sitter_id) then null
    when s.subscription_status in ('active', 'trialing', 'past_due')
      then case s.plan_tier when 's10' then 10 when 's20' then 20 else null end   -- no tier = legacy Pro (unlimited)
    else 3 end
    from sitters s where s.id = p_sitter_id
$$;

create or replace function public.sitter_child_count(p_sitter_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from children c
   where c.family_id in (select family_id from family_sitters
                          where sitter_id = p_sitter_id and status in ('active', 'pending'))
$$;

create or replace function public.my_sitter_plan()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare s sitters; v_perk text;
begin
  select * into s from sitters where id = auth.uid();
  if s.id is null then return null; end if;
  select f.name into v_perk from facility_staff fs join facilities f on f.id = fs.facility_id
   where fs.user_id = s.id and fs.status = 'active' and facility_in_good_standing(fs.facility_id)
   order by fs.created_at limit 1;
  return json_build_object(
    'tier', case when s.subscription_status in ('active', 'trialing', 'past_due') then coalesce(s.plan_tier, 'unlimited') end,
    'status', s.subscription_status, 'plan', s.subscription_plan,
    'complimentary', s.subscription_plan in ('free_founder', 'grandfathered'),
    'staff_perk', v_perk,
    'limit', sitter_child_limit(s.id), 'children', sitter_child_count(s.id),
    'trial_ends_at', s.trial_ends_at, 'current_period_end', s.current_period_end,
    'has_billing', s.stripe_customer_id is not null);
end $$;

-- Connecting a family: blocked if its children would put the sitter past their plan.
-- (Children a connected family adds later are never blocked; the app asks to upgrade.)
create or replace function public.enforce_free_family_limit()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_limit int; v_count int; v_new int;
begin
  if new.status not in ('active', 'pending') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('active', 'pending') and old.sitter_id = new.sitter_id then
    return new;   -- already counted (pending -> active when a family accepts)
  end if;
  if not is_client_request() or is_admin() then return new; end if;
  v_limit := sitter_child_limit(new.sitter_id);
  if v_limit is null then return new; end if;

  perform pg_advisory_xact_lock(hashtext('free_family_limit:' || new.sitter_id::text));
  select count(*) into v_count from children c
   where c.family_id in (select family_id from family_sitters
                          where sitter_id = new.sitter_id and status in ('active', 'pending')
                            and id <> new.id and family_id <> new.family_id);
  select count(*) into v_new from children where family_id = new.family_id;
  if v_count + v_new > v_limit then
    raise exception 'PLAN_CHILD_LIMIT: Your plan covers % children. Upgrade to add this family.', v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Helpers are called from triggers / definer functions only (they take any id, so the app
-- doesn't get them); the two summaries check the caller themselves.
revoke execute on function public.facility_in_good_standing(uuid), public.facility_child_limit(uuid),
  public.sitter_staff_perk(uuid), public.sitter_child_limit(uuid), public.sitter_child_count(uuid)
  from anon, authenticated, public;
grant execute on function public.facility_in_good_standing(uuid), public.facility_child_limit(uuid),
  public.sitter_staff_perk(uuid), public.sitter_child_limit(uuid), public.sitter_child_count(uuid) to service_role;
revoke execute on function public.facility_plan_summary(uuid), public.my_sitter_plan() from anon, public;
grant execute on function public.facility_plan_summary(uuid), public.my_sitter_plan() to authenticated, service_role;
