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

-- Tabel untuk menyimpan skor speaker per ronde per match
CREATE TABLE IF NOT EXISTS public.speaker_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
  points DECIMAL(4,2) CHECK (points >= 0 AND points <= 100),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint untuk memastikan satu speaker hanya punya satu skor per match
  UNIQUE(member_id, match_id)
);

-- Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_speaker_scores_member_id ON public.speaker_scores(member_id);
CREATE INDEX IF NOT EXISTS idx_speaker_scores_match_id ON public.speaker_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_speaker_scores_round_id ON public.speaker_scores(round_id);

-- RLS policies untuk speaker_scores
ALTER TABLE public.speaker_scores ENABLE ROW LEVEL SECURITY;

-- Read policy untuk anon (public viewing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='speaker_scores' AND policyname='speaker_scores readable by anon'
  ) THEN
    CREATE POLICY "speaker_scores readable by anon" 
    ON public.speaker_scores FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Write policies untuk admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='speaker_scores' AND policyname='speaker_scores write for admins'
  ) THEN
    CREATE POLICY "speaker_scores write for admins" 
    ON public.speaker_scores FOR ALL TO authenticated
    USING (EXISTS(SELECT 1 FROM public.users u WHERE (u.email = (auth.jwt() ->> 'email')) AND COALESCE(u.is_admin,false)))
    WITH CHECK (EXISTS(SELECT 1 FROM public.users u WHERE (u.email = (auth.jwt() ->> 'email')) AND COALESCE(u.is_admin,false)));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='speaker_scores' AND policyname='speaker_scores write for admins via uid'
  ) THEN
    CREATE POLICY "speaker_scores write for admins via uid" 
    ON public.speaker_scores FOR ALL TO authenticated
    USING (EXISTS(SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND COALESCE(u.is_admin,false)))
    WITH CHECK (EXISTS(SELECT 1 FROM public.users u WHERE u.auth_uid = auth.uid() AND COALESCE(u.is_admin,false)));
  END IF;
END $$;

-- Menambah kolom total_points ke tabel members
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Menambah kolom average_points ke tabel members untuk kemudahan query
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS average_points DECIMAL(5,2) DEFAULT 0.00;

-- Menambah kolom rounds_participated untuk tracking berapa ronde yang diikuti
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS rounds_participated INTEGER DEFAULT 0;

-- Function untuk menghitung total points, average, dan rounds participated
CREATE OR REPLACE FUNCTION public.update_member_statistics(member_uuid UUID)
RETURNS VOID AS $$
DECLARE
  total_pts INTEGER;
  avg_pts DECIMAL(5,2);
  rounds_count INTEGER;
BEGIN
  -- Hitung total points dan rounds dari speaker_scores
  SELECT 
    COALESCE(SUM(points), 0)::INTEGER,
    COALESCE(AVG(points), 0)::DECIMAL(5,2),
    COUNT(*)::INTEGER
  INTO total_pts, avg_pts, rounds_count
  FROM public.speaker_scores 
  WHERE member_id = member_uuid;
  
  -- Update tabel members
  UPDATE public.members 
  SET 
    total_points = total_pts,
    average_points = avg_pts,
    rounds_participated = rounds_count
  WHERE id = member_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_member_statistics(UUID) TO authenticated, anon;

-- Trigger function untuk otomatis update statistics ketika speaker_scores berubah
CREATE OR REPLACE FUNCTION public.trigger_update_member_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update untuk member_id lama (jika ada)
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM public.update_member_statistics(OLD.member_id);
  END IF;
  
  -- Update untuk member_id baru (jika ada)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.update_member_statistics(NEW.member_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buat trigger
DROP TRIGGER IF EXISTS speaker_scores_update_statistics ON public.speaker_scores;
CREATE TRIGGER speaker_scores_update_statistics
  AFTER INSERT OR UPDATE OR DELETE ON public.speaker_scores
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_member_statistics();

-- Create view untuk speaker standings dengan statistik lengkap
CREATE OR REPLACE VIEW public.speaker_standings AS
SELECT 
  m.id,
  COALESCE(u.full_name, u.email, 'Unknown Speaker') AS speaker_name,
  t.name AS team_name,
  t.institution,
  COALESCE(m.total_points, 0) AS total_points,
  COALESCE(m.average_points, 0.00) AS average_points,
  COALESCE(m.rounds_participated, 0) AS rounds_participated,
  t.tournament_id,
  -- Hitung standard deviation
  COALESCE((
    SELECT 
      CASE 
        WHEN COUNT(*) > 1 THEN 
          SQRT(SUM(POWER(ss.points - COALESCE(m.average_points, 0), 2)) / (COUNT(*) - 1))::DECIMAL(5,2)
        ELSE 0.00
      END
    FROM public.speaker_scores ss 
    WHERE ss.member_id = m.id
  ), 0.00) AS standard_deviation,
  -- Array skor per ronde untuk ditampilkan
  (
    SELECT array_agg(ss.points ORDER BY r.round_number)
    FROM public.speaker_scores ss
    JOIN public.rounds r ON r.id = ss.round_id
    WHERE ss.member_id = m.id
  ) AS round_scores
FROM public.members m
JOIN public.users u ON u.id = m.user_id
JOIN public.teams t ON t.id = m.team_id
-- Tampilkan semua member, bukan hanya yang sudah ada skornya
-- WHERE m.total_points > 0  -- Commented out untuk testing
ORDER BY COALESCE(m.total_points, 0) DESC, COALESCE(m.average_points, 0) DESC;

-- Grant access to view
GRANT SELECT ON public.speaker_standings TO anon, authenticated;
