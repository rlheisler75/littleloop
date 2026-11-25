-- Screens that crash in the app (src/components/ErrorBoundary.jsx + window error handlers).
-- Anyone can add a report about themselves; only littleloop admins read them. Reports carry
-- the error text, where it happened and the browser, nothing typed on the screen.
create table public.client_errors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  scope           text check (char_length(scope) <= 80),          -- app, sitter:profile, parent:home, window, promise ...
  message         text not null check (char_length(message) <= 2000),
  stack           text check (char_length(stack) <= 8000),
  component_stack text check (char_length(component_stack) <= 8000),
  url             text check (char_length(url) <= 300),
  user_agent      text check (char_length(user_agent) <= 400),
  created_at      timestamptz not null default now()
);
create index client_errors_created on public.client_errors (created_at desc);

-- Stamp the reporter and cap reports (30 per person, or per anonymous browser bucket, per hour)
create or replace function public.client_errors_stamp()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  if (select count(*) from client_errors
       where user_id is not distinct from auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    return null;   -- quietly drop
  end if;
  return new;
end $$;
create trigger trg_client_errors_stamp before insert on public.client_errors
  for each row execute function public.client_errors_stamp();

alter table public.client_errors enable row level security;
create policy "client_errors: anyone reports" on public.client_errors for insert to anon, authenticated with check (true);
create policy "client_errors: admins read" on public.client_errors for select using (is_admin());
grant insert on public.client_errors to anon, authenticated;
