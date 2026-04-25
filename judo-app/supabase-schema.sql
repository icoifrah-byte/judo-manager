-- ══════════════════════════════════════════
-- Judo Manager — Supabase Schema
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════

-- Enable realtime on all tables
-- (done via Supabase dashboard > Database > Replication)

-- ── competitions ──
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date,
  tatami_count int default 3,
  ref_code text default '1234',
  match_duration int default 180,
  created_at timestamptz default now()
);

-- ── categories ──
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id) on delete cascade,
  name text not null,
  method text default 'knockout',  -- 'knockout' | 'league'
  status text default 'pending',   -- 'pending' | 'live' | 'done'
  created_at timestamptz default now()
);

-- ── competitors ──
create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  name text not null,
  club text,
  seed int,
  attend_status text default 'unknown', -- 'unknown'|'arrived'|'absent'
  is_late bool default false,
  created_at timestamptz default now()
);

-- ── matches ──
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  tatami_id int,                       -- which tatami this match is on
  match_num int,                       -- bracket match number
  stage text,                          -- 'גמר','חצי גמר' etc.
  stage_type text,                     -- 'W'|'R'|'F'
  blue_id uuid references competitors(id),
  white_id uuid references competitors(id),
  status text default 'pending',       -- 'pending'|'live'|'done'|'suspended'|'bye'
  winner_id uuid references competitors(id),
  win_reason text,                     -- 'Ippon','Waza-ari × 2' etc.
  score jsonb default '{"bI":0,"bW":0,"bY":0,"bS":0,"wI":0,"wW":0,"wY":0,"wS":0}',
  is_offline bool default false,
  order_in_tatami int,                 -- queue order per tatami
  susp jsonb,                          -- {type:'matches'|'time', n, remaining}
  updated_at timestamptz default now()
);

-- ── Row Level Security ──
alter table competitions enable row level security;
alter table categories    enable row level security;
alter table competitors   enable row level security;
alter table matches       enable row level security;

-- Allow all for anon (app uses anon key — no auth for now)
create policy "allow all" on competitions for all using (true) with check (true);
create policy "allow all" on categories    for all using (true) with check (true);
create policy "allow all" on competitors   for all using (true) with check (true);
create policy "allow all" on matches       for all using (true) with check (true);

-- ── Auto-update updated_at ──
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger matches_updated_at
  before update on matches
  for each row execute function update_updated_at();

-- ── Enable Realtime ──
-- Run these after creating tables:
-- alter publication supabase_realtime add table matches;
-- alter publication supabase_realtime add table competitors;
