-- Run this in Supabase SQL editor to create the DebateTab schema
-- Safe to re-run (IF NOT EXISTS guards)

create extension if not exists pgcrypto;

-- Users (app-level users, not Supabase auth.users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  created_at timestamp default now()
);

-- Tournaments
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
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
  position text check (position in ('OG','OO','CG','CO')) not null
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
