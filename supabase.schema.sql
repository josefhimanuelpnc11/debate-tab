-- Run this in Supabase SQL editor to create the DebateTab schema
-- Safe to re-run (IF NOT EXISTS guards)

create extension if not exists pgcrypto;


-- Users (app-level users, not Supabase auth.users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  -- Some OAuth providers (e.g., GitHub with private email) don't expose email.
  -- Allow NULL here and rely on auth_uid for identity. Keep unique across non-null emails.
  email text unique,
  full_name text,
  created_at timestamp default now()
);

-- Ensure admin flag exists (placed AFTER table create to guarantee execution)
alter table if exists public.users add column if not exists is_admin boolean default false;

-- Link app user rows to Supabase Auth user id for robust RLS (works even if email is hidden)
alter table if exists public.users add column if not exists auth_uid uuid unique;

-- Best-effort backfill of auth_uid from auth.users by matching email
do $$ begin
  -- Only attempt if we can access auth.users
  perform 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='auth' and c.relname='users';
  -- Backfill rows that have matching email and missing auth_uid
  update public.users u
    set auth_uid = au.id
  from auth.users au
  where u.auth_uid is null and u.email is not null and au.email = u.email;
exception
  when undefined_table then
    -- Ignore if auth.users view isn't available in this context
    null;
end $$;

-- Tournaments
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  format text check (format in ('BP','AP')) default 'BP',
  created_by uuid references public.users(id) on delete cascade,
  created_at timestamp default now()
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  created_at timestamp default now()
);

-- Members (team membership of users)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  role text check (role in ('leader', 'member', 'substitute')) default 'member',
  created_at timestamp default now()
);

-- Speakers (named speakers within a team)
create table if not exists public.speakers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references public.teams(id) on delete cascade,
  speaker_order int check (speaker_order between 1 and 3),
  created_at timestamp default now()
);

-- Rounds
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  round_number int not null,
  motion text,
  created_at timestamp default now()
);

-- Matches (per round)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade,
  chair_judge uuid references public.users(id),
  created_at timestamp default now()
);

-- Match Teams (room positions)
create table if not exists public.match_teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  position text check (position in ('OG','OO','CG','CO','GOV','OPP')) not null
);

-- Results
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  points int check (points between 0 and 3) not null,
  rank int check (rank between 1 and 4),
  created_at timestamp default now()
);

-- Row Level Security: enable
alter table public.users enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.speakers enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.match_teams enable row level security;
alter table public.results enable row level security;

-- Allow authenticated users to read only their own user row (for is_admin checks)
-- Email-based (legacy) OR UID-based (preferred)
create policy if not exists "users self readable by email" on public.users
  for select to authenticated using (email = (auth.jwt() ->> 'email'));
create policy if not exists "users self readable by uid" on public.users
  for select to authenticated using (auth_uid = auth.uid());

-- Allow authenticated users to insert/update their own user profile row (no admin escalation)
-- Use client to upsert minimal profile (email, full_name). Admins should set is_admin via SQL.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users self insert'
  ) then
    create policy "users self insert" on public.users
      for insert to authenticated
      with check (
        -- either matches by email (legacy) or by auth uid (preferred)
        email = (auth.jwt() ->> 'email') or auth_uid = auth.uid()
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users self update'
  ) then
    create policy "users self update" on public.users
      for update to authenticated
      using (
        email = (auth.jwt() ->> 'email') or auth_uid = auth.uid()
      )
      with check (
        email = (auth.jwt() ->> 'email') or auth_uid = auth.uid()
      );
  end if;
  -- Add explicit uid-based insert/update policies if older ones exist
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users self insert via uid'
  ) then
    create policy "users self insert via uid" on public.users
      for insert to authenticated
      with check (auth_uid = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users self update via uid'
  ) then
    create policy "users self update via uid" on public.users
      for update to authenticated
      using (auth_uid = auth.uid())
      with check (auth_uid = auth.uid());
  end if;
end $$;

-- Helper to determine if current JWT belongs to an admin. SECURITY DEFINER bypasses RLS inside.
create or replace function public.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_admin, false)
  from public.users
  where auth_uid = auth.uid() or email = (auth.jwt() ->> 'email')
  limit 1;
$$;
grant execute on function public.current_is_admin() to anon, authenticated;

-- Admin policies on users: allow admins to read and manage all user rows
do $$ begin
  -- Replace existing admin policies to ensure they use the function (robust against RLS recursion)
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users readable by admins'
  ) then
    drop policy "users readable by admins" on public.users;
  end if;
  create policy "users readable by admins" on public.users
    for select to authenticated
    using (public.current_is_admin());

  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users write for admins'
  ) then
    drop policy "users write for admins" on public.users;
  end if;
  create policy "users write for admins" on public.users
    for all to authenticated
    using (public.current_is_admin())
    with check (public.current_is_admin());
end $$;

-- Write policies: only users with is_admin = true can write
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments write for admins'
  ) then
    create policy "tournaments write for admins" on public.tournaments
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tournaments' and policyname='tournaments write for admins via uid'
  ) then
    create policy "tournaments write for admins via uid" on public.tournaments
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='teams write for admins'
  ) then
    create policy "teams write for admins" on public.teams
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='teams' and policyname='teams write for admins via uid'
  ) then
    create policy "teams write for admins via uid" on public.teams
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='members' and policyname='members write for admins'
  ) then
    create policy "members write for admins" on public.members
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='members' and policyname='members write for admins via uid'
  ) then
    create policy "members write for admins via uid" on public.members
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='speakers' and policyname='speakers write for admins'
  ) then
    create policy "speakers write for admins" on public.speakers
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='speakers' and policyname='speakers write for admins via uid'
  ) then
    create policy "speakers write for admins via uid" on public.speakers
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds write for admins'
  ) then
    create policy "rounds write for admins" on public.rounds
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='rounds' and policyname='rounds write for admins via uid'
  ) then
    create policy "rounds write for admins via uid" on public.rounds
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches write for admins'
  ) then
    create policy "matches write for admins" on public.matches
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='matches' and policyname='matches write for admins via uid'
  ) then
    create policy "matches write for admins via uid" on public.matches
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='match_teams' and policyname='match_teams write for admins'
  ) then
    create policy "match_teams write for admins" on public.match_teams
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='match_teams' and policyname='match_teams write for admins via uid'
  ) then
    create policy "match_teams write for admins via uid" on public.match_teams
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='results' and policyname='results write for admins'
  ) then
    create policy "results write for admins" on public.results
      for all to authenticated
      using (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where (u.email = (auth.jwt() ->> 'email')) and coalesce(u.is_admin,false)));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='results' and policyname='results write for admins via uid'
  ) then
    create policy "results write for admins via uid" on public.results
      for all to authenticated
      using (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists(select 1 from public.users u where u.auth_uid = auth.uid() and coalesce(u.is_admin,false)));
  end if;
end $$;

-- Read-only policies for public browsing (anon role)
-- Do NOT expose users table by default
create policy if not exists "tournaments readable by anon" on public.tournaments
  for select to anon using (true);
create policy if not exists "teams readable by anon" on public.teams
  for select to anon using (true);
create policy if not exists "members readable by anon" on public.members
  for select to anon using (true);
create policy if not exists "speakers readable by anon" on public.speakers
  for select to anon using (true);
create policy if not exists "rounds readable by anon" on public.rounds
  for select to anon using (true);
create policy if not exists "matches readable by anon" on public.matches
  for select to anon using (true);
create policy if not exists "match_teams readable by anon" on public.match_teams
  for select to anon using (true);
create policy if not exists "results readable by anon" on public.results
  for select to anon using (true);
