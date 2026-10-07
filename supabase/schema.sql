-- Wanderlist schema. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: it drops and recreates policies/functions, but never drops tables.

create extension if not exists pgcrypto;

-- ─── Tables ────────────────────────────────────────────────────────────────

-- Invite list. Only emails here can see or change anything. Delete a row to remove someone.
create table if not exists public.invites (
  email      text primary key check (email = lower(email)),
  role       text not null default 'member' check (role in ('member', 'admin')),
  invited_at timestamptz not null default now()
);

-- One-time join links. Only a hash is stored. No API role can read this table (RLS on, no policies);
-- the /api/join route reads it with the service-role key.
create table if not exists public.invite_tokens (
  email      text primary key references public.invites (email) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  address    text,
  area       text,
  category   text not null check (category in ('eat','cafe','adventure','chill','trail','culture','activity','night')),
  note       text check (char_length(note) <= 1000),
  source_url text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per (person, place). A row existing means that person saved the place.
create table if not exists public.place_status (
  place_id   uuid not null references public.places (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  status     text not null check (status in ('want', 'planning', 'visited')),
  rating     smallint check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  date       date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.plan_places (
  plan_id  uuid not null references public.plans (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position int  not null default 0,
  primary key (plan_id, place_id)
);

create index if not exists place_status_user_idx on public.place_status (user_id);
create index if not exists places_created_by_idx on public.places (created_by);

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invites where email = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invites where email = lower(auth.jwt() ->> 'email') and role = 'admin');
$$;

-- Issues a fresh 7-day join link token for an email (creating/updating its invite).
-- Not callable from the app directly: run it in the SQL editor to bootstrap the first admin.
create or replace function public.issue_invite_token(p_email text, p_role text default 'member') returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(p_email));
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email'; end if;
  if p_role not in ('member', 'admin') then raise exception 'Invalid role'; end if;
  insert into invites (email, role) values (v_email, p_role)
    on conflict (email) do update set role = excluded.role;
  insert into invite_tokens (email, token_hash, expires_at)
    values (v_email, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '7 days')
    on conflict (email) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  return v_token;
end;
$$;
revoke execute on function public.issue_invite_token(text, text) from public, anon, authenticated;

-- What the app calls: same thing, admins only. Also used to send a "reset password" link.
create or replace function public.create_invite_link(p_email text, p_role text default 'member') returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can invite people'; end if;
  return public.issue_invite_token(p_email, p_role);
end;
$$;
revoke execute on function public.create_invite_link(text, text) from public, anon;
grant execute on function public.create_invite_link(text, text) to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

drop trigger if exists place_status_touch on public.place_status;
create trigger place_status_touch before update on public.place_status
  for each row execute function public.touch_updated_at();

-- Nobody can reassign who added a place.
create or replace function public.lock_created_by() returns trigger
language plpgsql as $$
begin
  new.created_by = old.created_by;
  return new;
end;
$$;

drop trigger if exists places_lock_creator on public.places;
create trigger places_lock_creator before update on public.places
  for each row execute function public.lock_created_by();

-- Create a profile for every new login. Access is still gated by the invites table.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email), left(split_part(new.email, '@', 1), 40))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ────────────────────────────────────────────────────

alter table public.invites      enable row level security;
alter table public.invite_tokens enable row level security;
alter table public.profiles     enable row level security;
alter table public.places       enable row level security;
alter table public.place_status enable row level security;
alter table public.plans        enable row level security;
alter table public.plan_places  enable row level security;

-- invites: members can read the list (and check their own invite); admins manage it.
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select
  using (public.is_member());
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all
  using (public.is_admin()) with check (public.is_admin());

-- profiles: members see everyone; you can create/rename only yourself.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (public.is_member());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() and email = lower(auth.jwt() ->> 'email'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and email = lower(auth.jwt() ->> 'email'));

-- places: everyone in the group adds and sees; only the adder or an admin edits/deletes.
drop policy if exists places_select on public.places;
create policy places_select on public.places for select
  using (public.is_member());
drop policy if exists places_insert on public.places;
create policy places_insert on public.places for insert
  with check (public.is_member() and created_by = auth.uid());
drop policy if exists places_update on public.places;
create policy places_update on public.places for update
  using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists places_delete on public.places;
create policy places_delete on public.places for delete
  using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

-- place_status: everyone sees everyone's status; you only change your own.
drop policy if exists status_select on public.place_status;
create policy status_select on public.place_status for select
  using (public.is_member());
drop policy if exists status_write on public.place_status;
create policy status_write on public.place_status for all
  using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid());

-- plans: anyone creates and edits stops (plans are collaborative); creator or admin deletes.
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select
  using (public.is_member());
drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans for insert
  with check (public.is_member() and created_by = auth.uid());
drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans for update
  using (public.is_member());
drop policy if exists plans_delete on public.plans;
create policy plans_delete on public.plans for delete
  using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

drop policy if exists plan_places_all on public.plan_places;
create policy plan_places_all on public.plan_places for all
  using (public.is_member()) with check (public.is_member());

-- ─── Realtime (live updates when a friend adds a place) ────────────────────

do $$
declare t text;
begin
  foreach t in array array['places','place_status','plans','plan_places','profiles','invites'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─── First admin ───────────────────────────────────────────────────────────
-- Run this once with YOUR email. It returns a token; open  <your app URL>/join#<token>
-- (e.g. http://localhost:3000/join#abc123…) to set your password. Invite everyone else from the app.
--
--   select public.issue_invite_token('you@gmail.com', 'admin');
