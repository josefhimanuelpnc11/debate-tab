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

-- Regions for institutional grouping
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamp default now()
);

-- Institutions
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  region_id uuid references public.regions(id),
  url text,
  created_at timestamp default now(),
  unique(name, code)
);

-- Enhanced Tournaments with Tabbycat-like features
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  slug text unique not null,
  description text,
  format text check (format in ('BP','AP','2vs2')) default 'BP',
  created_by uuid references public.users(id) on delete cascade,
  active boolean default true,
  current_round_id uuid,
  
  -- Tournament configuration (Tabbycat-like preferences)
  preferences jsonb default '{
    "teams_in_debate": 4,
    "speakers_in_team": 2,
    "substantive_speakers": 2,
    "reply_scores_enabled": true,
    "min_speaker_score": 68.0,
    "max_speaker_score": 82.0,
    "speaker_score_step": 0.5,
    "team_points_win": 1,
    "team_points_loss": 0,
    "draw_side_allocations": "balance",
    "public_results": false,
    "public_draw": false,
    "public_standings": false,
    "enable_checkins": true,
    "enable_motions": true,
    "enable_venue_constraints": false
  }'::jsonb,
  
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Tournament-Institution relationship
create table if not exists public.tournament_institutions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete cascade,
  teams_requested integer default 0,
  teams_allocated integer default 0,
  adjudicators_requested integer default 0,
  adjudicators_allocated integer default 0,
  created_at timestamp default now(),
  unique(tournament_id, institution_id)
);

-- Break Categories (Open, ESL, Novice, etc.)
create table if not exists public.break_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  name text not null,
  slug text not null,
  seq integer default 1,
  break_size integer default 16,
  is_general boolean default false,
  description text,
  created_at timestamp default now(),
  unique(tournament_id, slug)
);

-- Speaker Categories (Gender, experience levels, etc.)
create table if not exists public.speaker_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  name text not null,
  slug text not null,
  seq integer default 1,
  limit_per_institution integer,
  description text,
  created_at timestamp default now(),
  unique(tournament_id, slug)
);

-- Enhanced Teams with Tabbycat-like features
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  reference text not null, -- Team suffix (A, B, 1, 2, etc.)
  short_reference text,
  code_name text, -- Public display name for anonymization
  seed integer,
  emoji text,
  
  -- Auto-generated names
  short_name text generated always as (
    case 
      when institution_id is not null 
      then (select code from public.institutions where id = institution_id) || ' ' || coalesce(short_reference, reference)
      else coalesce(short_reference, reference)
    end
  ) stored,
  
  long_name text generated always as (
    case 
      when institution_id is not null 
      then (select name from public.institutions where id = institution_id) || ' ' || coalesce(reference, '')
      else coalesce(reference, '')
    end
  ) stored,
  
  -- Team types
  team_type text check (team_type in ('normal', 'swing', 'composite', 'bye')) default 'normal',
  
  -- Break eligibility - many-to-many via junction table
  use_institution_prefix boolean default true,
  created_at timestamp default now(),
  unique(tournament_id, institution_id, reference)
);

-- Team-Break Category relationship
create table if not exists public.team_break_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  break_category_id uuid references public.break_categories(id) on delete cascade,
  created_at timestamp default now(),
  unique(team_id, break_category_id)
);

-- Members (team membership of users)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  role text check (role in ('leader', 'member', 'substitute')) default 'member',
  created_at timestamp default now()
);

-- Enhanced Speakers with person-like attributes
create table if not exists public.speakers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references public.teams(id) on delete cascade,
  
  -- Personal information
  email text,
  phone text,
  gender text check (gender in ('M', 'F', 'O')),
  pronouns text,
  
  -- Privacy and anonymization
  anonymous boolean default false,
  code_name text, -- For anonymous display
  url_key text unique, -- Private URL access
  
  -- Speaking position and eligibility
  speaker_order integer check (speaker_order between 1 and 3),
  
  created_at timestamp default now()
);

-- Speaker-Category relationship  
create table if not exists public.speaker_categories_assignments (
  id uuid primary key default gen_random_uuid(),
  speaker_id uuid references public.speakers(id) on delete cascade,
  speaker_category_id uuid references public.speaker_categories(id) on delete cascade,
  created_at timestamp default now(),
  unique(speaker_id, speaker_category_id)
);

-- Adjudicators (missing from original schema!)
create table if not exists public.adjudicators (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  institution_id uuid references public.institutions(id),
  
  -- Personal information
  name text not null,
  email text,
  phone text,
  gender text check (gender in ('M', 'F', 'O')),
  pronouns text,
  
  -- Privacy and anonymization
  anonymous boolean default false,
  code_name text,
  url_key text unique,
  
  -- Adjudication attributes
  base_score decimal(4,2) default 5.0,
  trainee boolean default false,
  breaking boolean default false,
  independent boolean default false,
  adj_core boolean default false,
  
  -- Cached scores for performance
  test_score decimal(4,2),
  
  created_at timestamp default now(),
  unique(tournament_id, user_id)
);

-- Adjudicator conflict management
create table if not exists public.adjudicator_conflicts (
  id uuid primary key default gen_random_uuid(),
  adjudicator_id uuid references public.adjudicators(id) on delete cascade,
  
  -- Conflict targets (exactly one should be set)
  conflict_institution_id uuid references public.institutions(id) on delete cascade,
  conflict_team_id uuid references public.teams(id) on delete cascade,
  conflict_adjudicator_id uuid references public.adjudicators(id) on delete cascade,
  
  created_at timestamp default now(),
  
  -- Ensure exactly one conflict target is set
  check (
    (conflict_institution_id is not null)::integer + 
    (conflict_team_id is not null)::integer + 
    (conflict_adjudicator_id is not null)::integer = 1
  )
);

-- Venues (missing from original schema!)
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  name text not null,
  display_name text,
  priority integer default 0,
  external_url text,
  
  -- Venue categories for constraints
  categories jsonb default '[]'::jsonb,
  
  created_at timestamp default now(),
  unique(tournament_id, name)
);

-- Enhanced Rounds with Tabbycat-like features
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  seq integer not null, -- Round sequence (1, 2, 3, ...)
  name text not null, -- "Round 1", "Quarterfinals"
  abbreviation text, -- "R1", "QF"
  completed boolean default false,
  
  -- Round types and stages
  stage text check (stage in ('preliminary', 'elimination')) default 'preliminary',
  
  -- Draw generation
  draw_type text check (draw_type in ('random', 'manual', 'round_robin', 'power_paired', 'elimination', 'seeded')) default 'power_paired',
  draw_status text check (draw_status in ('none', 'draft', 'confirmed', 'released')) default 'none',
  
  -- Break rounds
  break_category_id uuid references public.break_categories(id),
  
  -- Timing and configuration
  starts_at timestamp,
  feedback_weight decimal(3,2) default 0.7,
  silent boolean default false, -- Silent round (not published)
  motions_released boolean default false,
  weight integer default 1, -- Point multiplier
  
  created_at timestamp default now(),
  unique(tournament_id, seq)
);

-- Motions (enhanced from simple text field)
create table if not exists public.motions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade,
  seq integer default 1,
  text text not null,
  info_slide text,
  reference text,
  created_at timestamp default now()
);

-- Enhanced Debates (was "matches")
create table if not exists public.debates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade,
  venue_id uuid references public.venues(id),
  
  -- Bracket and importance for adjudicator allocation
  bracket decimal(5,2) default 0, -- Bracket strength (higher = stronger teams)
  room_rank integer default 0, -- Room quality ranking
  importance integer default 0 check (importance between -2 and 2), -- Importance level
  
  -- Status tracking
  result_status text check (result_status in ('none', 'postponed', 'draft', 'confirmed')) default 'none',
  sides_confirmed boolean default false,
  
  -- Draw generation metadata
  flags jsonb default '[]'::jsonb,
  
  created_at timestamp default now()
);

-- Debate-Team relationship (replaces match_teams)
create table if not exists public.debate_teams (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references public.debates(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  side integer not null check (side between 0 and 3), -- 0=OG, 1=OO, 2=CG, 3=CO (or 0=AFF, 1=NEG for 2-team)
  created_at timestamp default now(),
  unique(debate_id, team_id),
  unique(debate_id, side)
);

-- Debate-Adjudicator relationship
create table if not exists public.debate_adjudicators (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references public.debates(id) on delete cascade,
  adjudicator_id uuid references public.adjudicators(id) on delete cascade,
  type text check (type in ('chair', 'panellist', 'trainee')) not null,
  created_at timestamp default now(),
  unique(debate_id, adjudicator_id)
);

-- Ballot Submissions (Tabbycat-style versioning system)
create table if not exists public.ballot_submissions (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid references public.debates(id) on delete cascade,
  motion_id uuid references public.motions(id),
  
  -- Submission metadata
  submitter_type text check (submitter_type in ('tabroom', 'public', 'automation')) default 'tabroom',
  submitter_user_id uuid references public.users(id),
  version integer default 1,
  confirmed boolean default false,
  
  -- Private ballot access
  url_key text unique,
  
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Team Results (linked to ballot submissions)
create table if not exists public.team_scores (
  id uuid primary key default gen_random_uuid(),
  ballot_submission_id uuid references public.ballot_submissions(id) on delete cascade,
  debate_team_id uuid references public.debate_teams(id) on delete cascade,
  points integer check (points between 0 and 3) not null,
  win boolean not null,
  margin decimal(5,2) default 0,
  created_at timestamp default now(),
  unique(ballot_submission_id, debate_team_id)
);

-- Speaker Scores (enhanced)
create table if not exists public.speaker_scores_new (
  id uuid primary key default gen_random_uuid(),
  ballot_submission_id uuid references public.ballot_submissions(id) on delete cascade,
  speaker_id uuid references public.speakers(id) on delete cascade,
  position integer check (position between 1 and 4), -- 1, 2, 3, Reply
  score decimal(4,2) check (score >= 0),
  ghost boolean default false, -- For swing speakers
  created_at timestamp default now(),
  unique(ballot_submission_id, speaker_id, position)
);

-- Adjudicator Feedback System
create table if not exists public.adjudicator_feedback (
  id uuid primary key default gen_random_uuid(),
  adjudicator_id uuid references public.adjudicators(id) on delete cascade,
  debate_id uuid references public.debates(id) on delete cascade,
  
  -- Feedback source (exactly one should be set)
  source_adjudicator_id uuid references public.adjudicators(id),
  source_team_id uuid references public.teams(id),
  
  -- Feedback content
  score decimal(4,2) not null,
  comments text,
  
  -- Moderation
  confirmed boolean default false,
  ignored boolean default false,
  
  -- Private access
  url_key text unique,
  
  created_at timestamp default now(),
  
  -- Ensure exactly one source is set
  check (
    (source_adjudicator_id is not null)::integer + 
    (source_team_id is not null)::integer = 1
  )
);

-- Check-in System
create table if not exists public.checkin_identifiers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  
  -- Participant reference (exactly one should be set)
  team_id uuid references public.teams(id) on delete cascade,
  adjudicator_id uuid references public.adjudicators(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  
  identifier text unique not null, -- QR code or unique identifier
  created_at timestamp default now(),
  
  -- Ensure exactly one participant type is set
  check (
    (team_id is not null)::integer + 
    (adjudicator_id is not null)::integer + 
    (venue_id is not null)::integer = 1
  )
);

create table if not exists public.checkin_status (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds(id) on delete cascade,
  checkin_identifier_id uuid references public.checkin_identifiers(id) on delete cascade,
  checked_in boolean default false,
  checkin_time timestamp,
  created_at timestamp default now(),
  unique(round_id, checkin_identifier_id)
);

-- Row Level Security: enable for all new tables
alter table public.regions enable row level security;
alter table public.institutions enable row level security;
alter table public.tournament_institutions enable row level security;
alter table public.break_categories enable row level security;
alter table public.speaker_categories enable row level security;
alter table public.team_break_categories enable row level security;
alter table public.speaker_categories_assignments enable row level security;
alter table public.adjudicators enable row level security;
alter table public.adjudicator_conflicts enable row level security;
alter table public.venues enable row level security;
alter table public.motions enable row level security;
alter table public.debates enable row level security;
alter table public.debate_teams enable row level security;
alter table public.debate_adjudicators enable row level security;
alter table public.ballot_submissions enable row level security;
alter table public.team_scores enable row level security;
alter table public.speaker_scores_new enable row level security;
alter table public.adjudicator_feedback enable row level security;
alter table public.checkin_identifiers enable row level security;
alter table public.checkin_status enable row level security;

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
  for select to anon using (active = true);
create policy if not exists "regions readable by anon" on public.regions
  for select to anon using (true);
create policy if not exists "institutions readable by anon" on public.institutions
  for select to anon using (true);
create policy if not exists "teams readable by anon" on public.teams
  for select to anon using (true);
create policy if not exists "speakers readable by anon" on public.speakers
  for select to anon using (true);
create policy if not exists "adjudicators readable by anon" on public.adjudicators
  for select to anon using (not anonymous);
create policy if not exists "venues readable by anon" on public.venues
  for select to anon using (true);
create policy if not exists "rounds readable by anon" on public.rounds
  for select to anon using (true);
create policy if not exists "motions readable by anon" on public.motions
  for select to anon using (true);
create policy if not exists "debates readable by anon" on public.debates
  for select to anon using (true);
create policy if not exists "debate_teams readable by anon" on public.debate_teams
  for select to anon using (true);
create policy if not exists "debate_adjudicators readable by anon" on public.debate_adjudicators
  for select to anon using (true);
create policy if not exists "team_scores readable by anon" on public.team_scores
  for select to anon using (true);
create policy if not exists "speaker_scores_new readable by anon" on public.speaker_scores_new
  for select to anon using (true);

-- Legacy table policies (keep for backward compatibility)
create policy if not exists "members readable by anon" on public.members
  for select to anon using (true);
create policy if not exists "results readable by anon" on public.results
  for select to anon using (true);

-- Add foreign key constraint to link current round
alter table public.tournaments 
add constraint fk_tournaments_current_round 
foreign key (current_round_id) references public.rounds(id);

-- Create indexes for performance
create index if not exists idx_teams_tournament_id on public.teams(tournament_id);
create index if not exists idx_teams_institution_id on public.teams(institution_id);
create index if not exists idx_speakers_team_id on public.speakers(team_id);
create index if not exists idx_adjudicators_tournament_id on public.adjudicators(tournament_id);
create index if not exists idx_debates_round_id on public.debates(round_id);
create index if not exists idx_debates_venue_id on public.debates(venue_id);
create index if not exists idx_debate_teams_debate_id on public.debate_teams(debate_id);
create index if not exists idx_debate_teams_team_id on public.debate_teams(team_id);
create index if not exists idx_team_scores_ballot_submission_id on public.team_scores(ballot_submission_id);
create index if not exists idx_speaker_scores_ballot_submission_id on public.speaker_scores_new(ballot_submission_id);
create index if not exists idx_speaker_scores_speaker_id on public.speaker_scores_new(speaker_id);

-- Utility functions for Tabbycat-like operations

-- Function to calculate team standings
create or replace function public.calculate_team_standings(tournament_uuid uuid)
returns table (
  team_id uuid,
  team_name text,
  institution_name text,
  wins integer,
  total_speaker_score decimal(8,2),
  average_speaker_score decimal(5,2),
  total_margin decimal(8,2),
  draw_strength decimal(8,2)
) language sql stable as $$
  select 
    t.id as team_id,
    t.short_name as team_name,
    i.name as institution_name,
    coalesce(sum(case when ts.win then 1 else 0 end), 0)::integer as wins,
    coalesce(sum(ssc.total_score), 0) as total_speaker_score,
    coalesce(avg(ssc.total_score), 0) as average_speaker_score,
    coalesce(sum(ts.margin), 0) as total_margin,
    0::decimal as draw_strength -- Placeholder for complex calculation
  from public.teams t
  left join public.institutions i on i.id = t.institution_id
  left join public.debate_teams dt on dt.team_id = t.id
  left join public.debates d on d.id = dt.debate_id
  left join public.ballot_submissions bs on bs.debate_id = d.id and bs.confirmed = true
  left join public.team_scores ts on ts.ballot_submission_id = bs.id and ts.debate_team_id = dt.id
  left join (
    -- Subquery to calculate total speaker scores per debate per team
    select 
      dt.id as debate_team_id,
      bs.id as ballot_submission_id,
      sum(ss.score) as total_score
    from public.debate_teams dt
    join public.speakers sp on sp.team_id = dt.team_id
    join public.speaker_scores_new ss on ss.speaker_id = sp.id
    join public.ballot_submissions bs on bs.id = ss.ballot_submission_id
    where bs.confirmed = true
    group by dt.id, bs.id
  ) ssc on ssc.debate_team_id = dt.id and ssc.ballot_submission_id = bs.id
  where t.tournament_id = tournament_uuid
  group by t.id, t.short_name, i.name
  order by wins desc, total_speaker_score desc, total_margin desc;
$$;

-- Function to calculate speaker standings
create or replace function public.calculate_speaker_standings(tournament_uuid uuid)
returns table (
  speaker_id uuid,
  speaker_name text,
  team_name text,
  institution_name text,
  total_score decimal(8,2),
  average_score decimal(5,2),
  speeches_count integer,
  standard_deviation decimal(5,2)
) language sql stable as $$
  select 
    sp.id as speaker_id,
    sp.name as speaker_name,
    t.short_name as team_name,
    i.name as institution_name,
    coalesce(sum(ss.score), 0) as total_score,
    coalesce(avg(ss.score), 0) as average_score,
    count(ss.score)::integer as speeches_count,
    coalesce(stddev(ss.score), 0) as standard_deviation
  from public.speakers sp
  join public.teams t on t.id = sp.team_id
  left join public.institutions i on i.id = t.institution_id
  left join public.speaker_scores_new ss on ss.speaker_id = sp.id
  left join public.ballot_submissions bs on bs.id = ss.ballot_submission_id and bs.confirmed = true
  where t.tournament_id = tournament_uuid
  group by sp.id, sp.name, t.short_name, i.name
  order by total_score desc, average_score desc;
$$;

-- Function to get current tournament state
create or replace function public.get_tournament_state(tournament_uuid uuid)
returns json language sql stable as $$
  select json_build_object(
    'tournament', (
      select json_build_object(
        'id', t.id,
        'name', t.name,
        'slug', t.slug,
        'current_round', cr.seq,
        'active', t.active,
        'preferences', t.preferences
      )
      from public.tournaments t
      left join public.rounds cr on cr.id = t.current_round_id
      where t.id = tournament_uuid
    ),
    'teams_count', (
      select count(*) from public.teams where tournament_id = tournament_uuid
    ),
    'adjudicators_count', (
      select count(*) from public.adjudicators where tournament_id = tournament_uuid
    ),
    'rounds_count', (
      select count(*) from public.rounds where tournament_id = tournament_uuid
    ),
    'completed_rounds', (
      select count(*) from public.rounds where tournament_id = tournament_uuid and completed = true
    )
  );
$$;

-- Grant execute permissions
grant execute on function public.calculate_team_standings(uuid) to anon, authenticated;
grant execute on function public.calculate_speaker_standings(uuid) to anon, authenticated;
grant execute on function public.get_tournament_state(uuid) to anon, authenticated;

-- Sample data insertion function for testing
create or replace function public.create_sample_tournament()
returns uuid language plpgsql as $$
declare
  tournament_uuid uuid;
  region_uuid uuid;
  institution1_uuid uuid;
  institution2_uuid uuid;
  break_cat_uuid uuid;
  speaker_cat_uuid uuid;
  round1_uuid uuid;
  team1_uuid uuid;
  team2_uuid uuid;
  speaker1_uuid uuid;
  speaker2_uuid uuid;
  adj_uuid uuid;
  venue_uuid uuid;
  debate_uuid uuid;
  motion_uuid uuid;
begin
  -- Create region
  insert into public.regions (name, slug) 
  values ('Asia Pacific', 'asia-pacific') 
  returning id into region_uuid;
  
  -- Create institutions
  insert into public.institutions (name, code, region_id) 
  values ('University of Oxford', 'Oxford', region_uuid) 
  returning id into institution1_uuid;
  
  insert into public.institutions (name, code, region_id) 
  values ('Harvard University', 'Harvard', region_uuid) 
  returning id into institution2_uuid;
  
  -- Create tournament
  insert into public.tournaments (name, short_name, slug, active) 
  values ('Asian Universities Debating Championship 2025', 'AUDC 2025', 'audc2025', true) 
  returning id into tournament_uuid;
  
  -- Create break category
  insert into public.break_categories (tournament_id, name, slug, is_general, break_size) 
  values (tournament_uuid, 'Open', 'open', true, 16) 
  returning id into break_cat_uuid;
  
  -- Create speaker category
  insert into public.speaker_categories (tournament_id, name, slug) 
  values (tournament_uuid, 'ESL', 'esl') 
  returning id into speaker_cat_uuid;
  
  -- Create teams
  insert into public.teams (tournament_id, institution_id, reference, short_reference) 
  values (tournament_uuid, institution1_uuid, 'A', 'A') 
  returning id into team1_uuid;
  
  insert into public.teams (tournament_id, institution_id, reference, short_reference) 
  values (tournament_uuid, institution2_uuid, '1', '1') 
  returning id into team2_uuid;
  
  -- Link teams to break category
  insert into public.team_break_categories (team_id, break_category_id) 
  values (team1_uuid, break_cat_uuid), (team2_uuid, break_cat_uuid);
  
  -- Create speakers
  insert into public.speakers (name, team_id, speaker_order) 
  values ('Alice Smith', team1_uuid, 1) 
  returning id into speaker1_uuid;
  
  insert into public.speakers (name, team_id, speaker_order) 
  values ('Bob Johnson', team2_uuid, 1) 
  returning id into speaker2_uuid;
  
  -- Create venue
  insert into public.venues (tournament_id, name, display_name, priority) 
  values (tournament_uuid, 'Main Hall', 'Main Debating Hall', 10) 
  returning id into venue_uuid;
  
  -- Create round
  insert into public.rounds (tournament_id, seq, name, abbreviation, stage, draw_type) 
  values (tournament_uuid, 1, 'Round 1', 'R1', 'preliminary', 'power_paired') 
  returning id into round1_uuid;
  
  -- Create motion
  insert into public.motions (round_id, text) 
  values (round1_uuid, 'This House believes that social media platforms should be held legally responsible for misinformation spread on their platforms') 
  returning id into motion_uuid;
  
  -- Update tournament current round
  update public.tournaments set current_round_id = round1_uuid where id = tournament_uuid;
  
  return tournament_uuid;
end;
$$;

-- Grant execute permission for sample data function
grant execute on function public.create_sample_tournament() to authenticated;
