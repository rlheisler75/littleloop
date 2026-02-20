-- ============================================================
-- littleloop — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists "uuid-ossp";


-- ============================================================
-- ENUMS
-- ============================================================

create type family_status   as enum ('active', 'pending', 'inactive');
create type member_role     as enum ('admin', 'member', 'feed_only', 'pickup');
create type member_status   as enum ('active', 'pending', 'removed');
create type post_type       as enum ('activity', 'meal', 'nap', 'photo', 'milestone', 'note');
create type post_mood       as enum ('happy', 'content', 'proud', 'excited', 'tired', 'fussy', 'rested', 'curious');
create type invoice_type    as enum ('hourly', 'tuition');
create type tuition_period  as enum ('daily', 'weekly', 'monthly');
create type checkin_status  as enum ('in', 'out');
create type payment_method  as enum ('Venmo', 'Zelle', 'Cash', 'Check', 'PayPal', 'Bank Transfer', 'Other');


-- ============================================================
-- CORE TABLES
-- ============================================================

-- ------------------------------------------------------------
-- SITTERS
-- One row per sitter account. Linked to auth.users via id.
-- ------------------------------------------------------------
create table public.sitters (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text        not null,
  email         text        not null unique,
  avatar_url    text,                          -- Supabase Storage URL
  bio           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.sitters is
  'One row per sitter. id matches auth.users.id so RLS can use auth.uid().';


-- ------------------------------------------------------------
-- FAMILIES
-- Created by a sitter when they invite a new family.
-- ------------------------------------------------------------
create table public.families (
  id            uuid        primary key default uuid_generate_v4(),
  sitter_id     uuid        not null references public.sitters(id) on delete cascade,
  name          text        not null,
  status        family_status not null default 'pending',
  admin_email   text        not null,          -- email that becomes first admin
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.families.admin_email is
  'Email the sitter entered when inviting. First person to sign up with this email becomes family admin.';


-- ------------------------------------------------------------
-- MEMBERS
-- Every parent/guardian/pickup person linked to a family.
-- Also linked to auth.users once they accept the invite.
-- ------------------------------------------------------------
create table public.members (
  id            uuid        primary key default uuid_generate_v4(),
  family_id     uuid        not null references public.families(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete set null,  -- null until invite accepted
  name          text        not null,
  email         text        not null,
  avatar        text        not null default '👤',   -- emoji avatar
  role          member_role not null default 'member',
  status        member_status not null default 'pending',
  invited_by    uuid        references public.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (family_id, email)   -- one membership per email per family
);

comment on column public.members.user_id is
  'Null until the invited person creates/logs into their account.';
comment on column public.members.invited_by is
  'Which member sent this invite (null if sitter created it).';


-- ------------------------------------------------------------
-- CHILDREN
-- Each child belongs to one family.
-- ------------------------------------------------------------
create table public.children (
  id                   uuid    primary key default uuid_generate_v4(),
  family_id            uuid    not null references public.families(id) on delete cascade,
  name                 text    not null,
  dob                  date,
  avatar               text    not null default '🌟',
  color                text    not null default '#8B78D4',  -- hex, used for UI chips
  photo_url            text,                                -- Supabase Storage URL
  allergies            text[]  not null default '{}',
  dietary_restrictions text,
  medical_notes        text,
  behavioral_notes     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Medications and emergency contacts are separate tables
-- (arrays of objects don't belong in a single column)


-- ------------------------------------------------------------
-- MEDICATIONS
-- Each medication belongs to one child.
-- ------------------------------------------------------------
create table public.medications (
  id            uuid    primary key default uuid_generate_v4(),
  child_id      uuid    not null references public.children(id) on delete cascade,
  name          text    not null,
  dose          text,
  instructions  text,
  created_at    timestamptz not null default now()
);


-- ------------------------------------------------------------
-- EMERGENCY CONTACTS
-- Each contact belongs to one child.
-- ------------------------------------------------------------
create table public.emergency_contacts (
  id            uuid    primary key default uuid_generate_v4(),
  child_id      uuid    not null references public.children(id) on delete cascade,
  name          text    not null,
  relation      text,
  phone         text    not null,
  created_at    timestamptz not null default now()
);


-- ------------------------------------------------------------
-- POSTS
-- Updates posted by the sitter or a parent to a family feed.
-- ------------------------------------------------------------
create table public.posts (
  id            uuid        primary key default uuid_generate_v4(),
  family_id     uuid        not null references public.families(id) on delete cascade,
  author_role   text        not null check (author_role in ('sitter', 'parent')),
  author_id     uuid        not null,   -- sitter_id or member_id depending on author_role
  type          post_type   not null default 'note',
  mood          post_mood,
  text          text,
  photo_url     text,                   -- Supabase Storage URL
  pinned        boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.posts.author_id is
  'References sitters.id when author_role=sitter, members.id when author_role=parent.
   Kept as plain uuid (no FK) because it can point to two different tables.';


-- ------------------------------------------------------------
-- POST_CHILDREN  (many-to-many: posts ↔ children)
-- Which children are tagged in a post.
-- ------------------------------------------------------------
create table public.post_children (
  post_id    uuid not null references public.posts(id) on delete cascade,
  child_id   uuid not null references public.children(id) on delete cascade,
  primary key (post_id, child_id)
);


-- ------------------------------------------------------------
-- POST_LIKES
-- One row per member who liked a post.
-- ------------------------------------------------------------
create table public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);


-- ------------------------------------------------------------
-- MESSAGES
-- Direct messages between a family and their sitter.
-- ------------------------------------------------------------
create table public.messages (
  id            uuid    primary key default uuid_generate_v4(),
  family_id     uuid    not null references public.families(id) on delete cascade,
  sender_role   text    not null check (sender_role in ('sitter', 'parent')),
  sender_id     uuid    not null,   -- sitter_id or member_id
  sender_name   text    not null,   -- denormalised for fast display
  text          text    not null,
  created_at    timestamptz not null default now()
);

create index messages_family_created on public.messages (family_id, created_at asc);


-- ------------------------------------------------------------
-- INVOICES
-- Issued by the sitter to a family.
-- ------------------------------------------------------------
create table public.invoices (
  id              uuid            primary key default uuid_generate_v4(),
  family_id       uuid            not null references public.families(id) on delete cascade,
  sitter_id       uuid            not null references public.sitters(id) on delete cascade,
  type            invoice_type    not null,

  -- Hourly fields
  hours           numeric(6,2),
  rate            numeric(8,2),

  -- Tuition fields
  tuition_period  tuition_period,
  tuition_rate    numeric(8,2),

  note            text,
  issued_date     date            not null default current_date,
  due_date        date,
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now(),

  constraint hourly_fields check (
    type <> 'hourly' or (hours is not null and rate is not null)
  ),
  constraint tuition_fields check (
    type <> 'tuition' or (tuition_period is not null and tuition_rate is not null)
  )
);


-- ------------------------------------------------------------
-- INVOICE_EXTRAS
-- Add-on line items on an invoice (supplies, meals, etc.)
-- ------------------------------------------------------------
create table public.invoice_extras (
  id          uuid        primary key default uuid_generate_v4(),
  invoice_id  uuid        not null references public.invoices(id) on delete cascade,
  label       text        not null,
  amount      numeric(8,2) not null,
  sort_order  smallint    not null default 0
);


-- ------------------------------------------------------------
-- PAYMENTS
-- One row per payment recorded against an invoice.
-- ------------------------------------------------------------
create table public.payments (
  id          uuid            primary key default uuid_generate_v4(),
  invoice_id  uuid            not null references public.invoices(id) on delete cascade,
  amount      numeric(8,2)    not null check (amount > 0),
  method      payment_method  not null default 'Other',
  note        text,
  paid_date   date            not null default current_date,
  recorded_by uuid,           -- member_id or sitter_id who recorded it
  created_at  timestamptz     not null default now()
);


-- ------------------------------------------------------------
-- CHECKINS
-- Current check-in state for each child. Upserted on change.
-- ------------------------------------------------------------
create table public.checkins (
  child_id      uuid            primary key references public.children(id) on delete cascade,
  status        checkin_status  not null default 'out',
  checked_at    timestamptz     not null default now(),
  checked_by    uuid,           -- member_id or sitter_id
  checked_by_role text          check (checked_by_role in ('sitter', 'parent'))
);


-- ============================================================
-- COMPUTED VIEW: invoice_totals
-- Saves the app from summing every time.
-- ============================================================
create or replace view public.invoice_totals as
select
  i.id                                                          as invoice_id,
  i.family_id,
  i.sitter_id,

  -- subtotal from line items
  case
    when i.type = 'hourly'  then coalesce(i.hours, 0) * coalesce(i.rate, 0)
    when i.type = 'tuition' then coalesce(i.tuition_rate, 0)
  end                                                           as base_amount,

  coalesce((
    select sum(e.amount)
    from public.invoice_extras e
    where e.invoice_id = i.id
  ), 0)                                                         as extras_total,

  case
    when i.type = 'hourly'  then coalesce(i.hours, 0) * coalesce(i.rate, 0)
    when i.type = 'tuition' then coalesce(i.tuition_rate, 0)
  end
  + coalesce((
    select sum(e.amount)
    from public.invoice_extras e
    where e.invoice_id = i.id
  ), 0)                                                         as total_amount,

  coalesce((
    select sum(p.amount)
    from public.payments p
    where p.invoice_id = i.id
  ), 0)                                                         as amount_paid,

  (
    case
      when i.type = 'hourly'  then coalesce(i.hours, 0) * coalesce(i.rate, 0)
      when i.type = 'tuition' then coalesce(i.tuition_rate, 0)
    end
    + coalesce((
      select sum(e.amount)
      from public.invoice_extras e
      where e.invoice_id = i.id
    ), 0)
  )
  - coalesce((
    select sum(p.amount)
    from public.payments p
    where p.invoice_id = i.id
  ), 0)                                                         as amount_remaining,

  case
    when coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0) = 0
      then 'unpaid'
    when coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)
      >= (
        case
          when i.type = 'hourly'  then coalesce(i.hours, 0) * coalesce(i.rate, 0)
          when i.type = 'tuition' then coalesce(i.tuition_rate, 0)
        end
        + coalesce((select sum(e.amount) from public.invoice_extras e where e.invoice_id = i.id), 0)
      )
      then 'paid'
    else 'partial'
  end                                                           as payment_status

from public.invoices i;


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sitters_updated_at
  before update on public.sitters
  for each row execute function public.set_updated_at();

create trigger families_updated_at
  before update on public.families
  for each row execute function public.set_updated_at();

create trigger members_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create trigger children_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();


-- ============================================================
-- AUTO-CREATE SITTER PROFILE ON SIGNUP
-- When a new user signs up as a sitter, insert into sitters.
-- The app should pass { role: 'sitter' } in signUp metadata.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  if new.raw_user_meta_data->>'role' = 'sitter' then
    insert into public.sitters (id, name, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- AUTO-ACTIVATE MEMBER ON SIGNUP
-- When a parent signs up with an email that matches a pending
-- member invite, link their auth.users id and set them active.
-- Also sets them as admin if their email matches family.admin_email.
-- ============================================================

create or replace function public.handle_member_activation()
returns trigger language plpgsql security definer as $$
declare
  v_member  public.members%rowtype;
  v_family  public.families%rowtype;
begin
  -- find any pending invites for this email
  select * into v_member
  from public.members
  where email = new.email
    and status = 'pending'
    and user_id is null
  limit 1;

  if found then
    -- link auth user → member
    update public.members
    set user_id = new.id,
        status  = 'active',
        name    = coalesce(new.raw_user_meta_data->>'name', name)
    where id = v_member.id;

    -- promote to admin if this is the family's designated admin email
    select * into v_family from public.families where id = v_member.family_id;
    if v_family.admin_email = new.email then
      update public.members set role = 'admin' where id = v_member.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_member_activation
  after insert on auth.users
  for each row execute function public.handle_member_activation();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- The most important part — enforces privacy at the DB level.
-- ============================================================

alter table public.sitters           enable row level security;
alter table public.families          enable row level security;
alter table public.members           enable row level security;
alter table public.children          enable row level security;
alter table public.medications       enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.posts             enable row level security;
alter table public.post_children     enable row level security;
alter table public.post_likes        enable row level security;
alter table public.messages          enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_extras    enable row level security;
alter table public.payments          enable row level security;
alter table public.checkins          enable row level security;


-- ── Helper functions used in RLS policies ──────────────────

-- Is the current user a sitter?
create or replace function public.is_sitter()
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.sitters where id = auth.uid())
$$;

-- Get the sitter_id for a given family (used to check ownership)
create or replace function public.family_sitter(p_family_id uuid)
returns uuid language sql security definer stable as $$
  select sitter_id from public.families where id = p_family_id
$$;

-- Get the family_id for the current auth user's member record
-- Returns null if user is not a member of that family
create or replace function public.my_family_id(p_family_id uuid)
returns uuid language sql security definer stable as $$
  select family_id
  from public.members
  where family_id = p_family_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

-- Get the role of the current user in a family
create or replace function public.my_role(p_family_id uuid)
returns member_role language sql security definer stable as $$
  select role
  from public.members
  where family_id = p_family_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

-- Can the current user view feed for this family?
create or replace function public.can_view_feed(p_family_id uuid)
returns boolean language sql security definer stable as $$
  select coalesce(public.my_role(p_family_id), null) in ('admin', 'member', 'feed_only')
$$;


-- ── SITTERS ────────────────────────────────────────────────

-- Sitters can read and update their own row
create policy "sitter: own row"
  on public.sitters for all
  using (id = auth.uid());


-- ── FAMILIES ──────────────────────────────────────────────

-- Sitter sees all families they own
create policy "sitter: own families"
  on public.families for all
  using (sitter_id = auth.uid());

-- Active members see their own family
create policy "member: own family"
  on public.families for select
  using (public.my_family_id(id) is not null);


-- ── MEMBERS ───────────────────────────────────────────────

-- Sitter sees all members of their families
create policy "sitter: see members of own families"
  on public.members for select
  using (public.family_sitter(family_id) = auth.uid());

-- Sitter can insert members (invite)
create policy "sitter: invite members"
  on public.members for insert
  with check (public.family_sitter(family_id) = auth.uid());

-- Sitter can update any member in their families (role changes, removal)
create policy "sitter: update members"
  on public.members for update
  using (public.family_sitter(family_id) = auth.uid());

-- Sitter can delete members
create policy "sitter: delete members"
  on public.members for delete
  using (public.family_sitter(family_id) = auth.uid());

-- Members can see all other members of their own family
create policy "member: see family members"
  on public.members for select
  using (public.my_family_id(family_id) is not null);

-- Admin members can invite new members to their family
create policy "admin: invite members"
  on public.members for insert
  with check (public.my_role(family_id) = 'admin');

-- Admin members can update roles of other members (not themselves to prevent lock-out)
create policy "admin: update member roles"
  on public.members for update
  using (
    public.my_role(family_id) = 'admin'
    and user_id <> auth.uid()   -- can't change own role
  );

-- Admin members can remove non-admin members
create policy "admin: remove members"
  on public.members for delete
  using (
    public.my_role(family_id) = 'admin'
    and role <> 'admin'          -- can't remove other admins (sitter does that)
    and user_id <> auth.uid()    -- can't remove self
  );

-- Members can update their own profile (name, avatar)
create policy "member: update own profile"
  on public.members for update
  using (user_id = auth.uid());


-- ── CHILDREN ──────────────────────────────────────────────

-- Sitter sees all children in their families
create policy "sitter: see children"
  on public.children for select
  using (public.family_sitter(family_id) = auth.uid());

-- Active members in the family can see children
create policy "member: see children"
  on public.children for select
  using (public.my_family_id(family_id) is not null);

-- Admin and standard members can update children's profiles
create policy "member: update child profiles"
  on public.children for update
  using (public.my_role(family_id) in ('admin', 'member'));

-- Only admins can add or remove children
create policy "admin: manage children"
  on public.children for insert
  with check (public.my_role(family_id) = 'admin');

create policy "admin: delete children"
  on public.children for delete
  using (public.my_role(family_id) = 'admin');


-- ── MEDICATIONS & EMERGENCY CONTACTS ──────────────────────
-- Inherit access through child → family membership

create policy "sitter: see medications"
  on public.medications for select
  using (
    public.family_sitter((select family_id from public.children where id = child_id)) = auth.uid()
  );

create policy "member: see medications"
  on public.medications for select
  using (
    public.my_family_id((select family_id from public.children where id = child_id)) is not null
  );

create policy "member: manage medications"
  on public.medications for all
  using (
    public.my_role((select family_id from public.children where id = child_id))
      in ('admin', 'member')
  );

create policy "sitter: see emergency contacts"
  on public.emergency_contacts for select
  using (
    public.family_sitter((select family_id from public.children where id = child_id)) = auth.uid()
  );

create policy "member: see emergency contacts"
  on public.emergency_contacts for select
  using (
    public.my_family_id((select family_id from public.children where id = child_id)) is not null
  );

create policy "member: manage emergency contacts"
  on public.emergency_contacts for all
  using (
    public.my_role((select family_id from public.children where id = child_id))
      in ('admin', 'member')
  );


-- ── POSTS ─────────────────────────────────────────────────

-- Sitter can do everything with posts in their families
create policy "sitter: manage posts"
  on public.posts for all
  using (public.family_sitter(family_id) = auth.uid());

-- Members who can view feed can read posts
create policy "member: read posts"
  on public.posts for select
  using (public.can_view_feed(family_id));

-- Admin and standard members can create posts
create policy "member: create posts"
  on public.posts for insert
  with check (public.my_role(family_id) in ('admin', 'member'));

-- Members can only update/delete their own posts
create policy "member: edit own posts"
  on public.posts for update
  using (
    author_role = 'parent'
    and author_id = (select id from public.members where user_id = auth.uid() and family_id = posts.family_id limit 1)
  );

create policy "member: delete own posts"
  on public.posts for delete
  using (
    author_role = 'parent'
    and author_id = (select id from public.members where user_id = auth.uid() and family_id = posts.family_id limit 1)
  );


-- ── POST_CHILDREN & POST_LIKES ────────────────────────────

create policy "sitter: manage post_children"
  on public.post_children for all
  using (
    public.family_sitter((select family_id from public.posts where id = post_id)) = auth.uid()
  );

create policy "member: see post_children"
  on public.post_children for select
  using (
    public.can_view_feed((select family_id from public.posts where id = post_id))
  );

create policy "member: add post_children"
  on public.post_children for insert
  with check (
    public.my_role((select family_id from public.posts where id = post_id)) in ('admin', 'member')
  );

create policy "member: like posts"
  on public.post_likes for all
  using (public.can_view_feed((select family_id from public.posts where id = post_id)));


-- ── MESSAGES ──────────────────────────────────────────────

-- Sitter can read/write messages for their families
create policy "sitter: manage messages"
  on public.messages for all
  using (public.family_sitter(family_id) = auth.uid());

-- Members who can send messages can read and write
create policy "member: read messages"
  on public.messages for select
  using (public.my_role(family_id) in ('admin', 'member'));

create policy "member: send messages"
  on public.messages for insert
  with check (public.my_role(family_id) in ('admin', 'member'));


-- ── INVOICES ──────────────────────────────────────────────

-- Sitter owns invoices
create policy "sitter: manage invoices"
  on public.invoices for all
  using (sitter_id = auth.uid());

-- Admin and standard members can view their family's invoices
create policy "member: view invoices"
  on public.invoices for select
  using (public.my_role(family_id) in ('admin', 'member'));


-- ── INVOICE_EXTRAS ─────────────────────────────────────────

create policy "sitter: manage extras"
  on public.invoice_extras for all
  using (
    public.family_sitter((select family_id from public.invoices where id = invoice_id)) = auth.uid()
  );

create policy "member: view extras"
  on public.invoice_extras for select
  using (
    public.my_role((select family_id from public.invoices where id = invoice_id)) in ('admin', 'member')
  );


-- ── PAYMENTS ──────────────────────────────────────────────

-- Sitter can do everything with payments
create policy "sitter: manage payments"
  on public.payments for all
  using (
    public.family_sitter((select family_id from public.invoices where id = invoice_id)) = auth.uid()
  );

-- Admin and standard members can view and record payments
create policy "member: view payments"
  on public.payments for select
  using (
    public.my_role((select family_id from public.invoices where id = invoice_id)) in ('admin', 'member')
  );

create policy "member: record payments"
  on public.payments for insert
  with check (
    public.my_role((select family_id from public.invoices where id = invoice_id)) in ('admin', 'member')
  );


-- ── CHECKINS ──────────────────────────────────────────────

-- Sitter can see and update all checkins for their families
create policy "sitter: manage checkins"
  on public.checkins for all
  using (
    public.family_sitter((select family_id from public.children where id = child_id)) = auth.uid()
  );

-- Members with check-in permission can read and upsert checkins
create policy "member: view checkins"
  on public.checkins for select
  using (
    public.my_role((select family_id from public.children where id = child_id))
      in ('admin', 'member', 'pickup')
  );

create policy "member: update checkins"
  on public.checkins for all
  using (
    public.my_role((select family_id from public.children where id = child_id))
      in ('admin', 'member', 'pickup')
  );


-- ============================================================
-- STORAGE BUCKETS
-- Run these in: Supabase Dashboard → Storage
-- Or via SQL as shown below.
-- ============================================================

-- Post photos (photos attached to feed updates)
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', false);

-- Child profile photos
insert into storage.buckets (id, name, public)
values ('child-photos', 'child-photos', false);

-- Sitter profile photos
insert into storage.buckets (id, name, public)
values ('sitter-avatars', 'sitter-avatars', false);


-- Storage RLS: sitter can upload/read post photos for their families
create policy "sitter: post photos"
  on storage.objects for all
  using (
    bucket_id = 'post-photos'
    and public.is_sitter()
  );

-- Members can read post photos for their family
-- (path convention: post-photos/{family_id}/{post_id}.jpg)
create policy "member: read post photos"
  on storage.objects for select
  using (
    bucket_id = 'post-photos'
    and public.my_family_id((string_to_array(name, '/'))[1]::uuid) is not null
  );

-- Members can upload to child-photos for their family
create policy "member: child photos"
  on storage.objects for all
  using (
    bucket_id = 'child-photos'
    and (
      public.is_sitter()
      or public.my_family_id((string_to_array(name, '/'))[1]::uuid) is not null
    )
  );

-- Sitters manage their own avatar
create policy "sitter: own avatar"
  on storage.objects for all
  using (
    bucket_id = 'sitter-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- REALTIME
-- Enable realtime on tables the UI needs to react to live.
-- Run in Supabase Dashboard → Database → Replication,
-- or uncomment these publication statements.
-- ============================================================

-- alter publication supabase_realtime add table public.posts;
-- alter publication supabase_realtime add table public.messages;
-- alter publication supabase_realtime add table public.checkins;
-- alter publication supabase_realtime add table public.post_likes;
-- alter publication supabase_realtime add table public.payments;


-- ============================================================
-- INDEXES
-- ============================================================

create index families_sitter       on public.families (sitter_id);
create index members_family        on public.members (family_id);
create index members_user          on public.members (user_id);
create index members_email         on public.members (email);
create index children_family       on public.children (family_id);
create index medications_child     on public.medications (child_id);
create index emergency_child       on public.emergency_contacts (child_id);
create index posts_family_created  on public.posts (family_id, created_at desc);
create index post_children_post    on public.post_children (post_id);
create index post_children_child   on public.post_children (child_id);
create index post_likes_post       on public.post_likes (post_id);
create index messages_family       on public.messages (family_id);
create index invoices_family       on public.invoices (family_id);
create index invoices_sitter       on public.invoices (sitter_id);
create index invoice_extras_inv    on public.invoice_extras (invoice_id);
create index payments_invoice      on public.payments (invoice_id);


-- ============================================================
-- DONE
-- ============================================================
-- Next step: wire up the React app using the Supabase JS client.
-- See: https://supabase.com/docs/reference/javascript
-- ============================================================
