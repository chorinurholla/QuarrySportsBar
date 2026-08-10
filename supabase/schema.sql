-- ============================================================
-- Quarry Sports Bar — Phase 2 schema (PostgreSQL / Supabase)
-- Run once in the Supabase SQL editor of a fresh project.
-- ============================================================

create table if not exists weeks (
  id            bigint generated always as identity primary key,
  saturday      date not null unique,
  state         text not null default 'draft'
                check (state in ('draft','teaser','open','live','results','settled','void')),
  picks_cutoff  timestamptz not null,          -- first kickoff
  numbers_close timestamptz not null,          -- 21:00 local
  draw_time     timestamptz not null,          -- 21:30 local
  min_entries   int  not null default 25,
  pool_full     int  not null default 50000,   -- naira
  fallback_pct  int  not null default 40,      -- pool = entries × ₦5,000 × 40% = ₦2,000/entry below min_entries
  draw_commit   text,                          -- sha256(seed) published at numbers_close
  draw_seed     text,                          -- revealed at draw time
  drawn_numbers int[],                         -- full bingo sequence (permutation of 0-49), drawn order
  winning_ball  int,                           -- 1-based ball on which the first entry completed all 7
  created_at    timestamptz not null default now()
);

create table if not exists fixtures (
  id          bigint generated always as identity primary key,
  week_id     bigint not null references weeks(id) on delete cascade,
  external_id text,                             -- football-data.org match id
  league      text not null,                    -- 'Premier League' | 'Bundesliga' | 'La Liga'
  home        text not null,
  away        text not null,
  kickoff_at  timestamptz not null,
  result      char(1) check (result in ('H','D','A','V')),  -- V = void (postponed/abandoned)
  sort        int not null default 0
);
create index if not exists fixtures_week on fixtures(week_id);

create table if not exists codes (
  code       text primary key,                  -- e.g. QRY-7284
  week_id    bigint not null references weeks(id) on delete cascade,
  status     text not null default 'issued' check (status in ('issued','redeemed','void')),
  issued_at  timestamptz not null default now(),
  redeemed_at timestamptz
);
create index if not exists codes_week on codes(week_id);

create table if not exists entries (
  id           bigint generated always as identity primary key,
  week_id      bigint not null references weeks(id) on delete cascade,
  code         text not null references codes(code),
  reference    text not null unique,            -- shown to the player
  first_name   text,
  phone        text not null,
  picks        jsonb,                           -- { "<fixture_id>": "H"|"D"|"A" } ; null if numbers-only (late entry)
  tiebreak     int,
  numbers      int[] not null,                  -- 7 distinct ints 0..49
  whatsapp_optin boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (week_id, code)                        -- one entry per code
);
create index if not exists entries_week on entries(week_id);
create index if not exists entries_phone on entries(week_id, phone);

create table if not exists winners (
  id         bigint generated always as identity primary key,
  week_id    bigint not null references weeks(id) on delete cascade,
  kind       text not null check (kind in ('picks','bingo')),
  entry_id   bigint references entries(id),
  display_name text not null,                   -- first name only
  amount     int not null,                      -- naira value (0 for drink voucher)
  note       text,
  photo_url  text,
  consent    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security: the anon key can read only what is public.
-- All writes go through server functions using the service key.
-- ------------------------------------------------------------
alter table weeks    enable row level security;
alter table fixtures enable row level security;
alter table codes    enable row level security;
alter table entries  enable row level security;
alter table winners  enable row level security;

-- Public reads: weeks (non-draft), fixtures, winners (consented rows expose name/amount only via view)
create policy weeks_public_read    on weeks    for select using (state <> 'draft');
create policy fixtures_public_read on fixtures for select
  using (exists (select 1 from weeks w where w.id = week_id and w.state <> 'draft'));
create policy winners_public_read  on winners  for select using (true);
-- codes and entries: NO public policies — service role only (protects phones).

-- Public leaderboard view: masked identity, no phone numbers.
create or replace view leaderboard as
select
  e.week_id,
  e.id as entry_id,
  coalesce(nullif(trim(e.first_name), ''), 'Player') || ' ··' || right(e.reference, 3) as display,
  e.tiebreak,
  (
    select count(*) from fixtures f
    where f.week_id = e.week_id
      and f.result in ('H','D','A')
      and (e.picks ->> f.id::text) = f.result
  ) as correct
from entries e
where e.picks is not null;

grant select on leaderboard to anon;

-- ------------------------------------------------------------
-- Atomic entry submission: validates the code and writes the
-- entry + code redemption in one transaction with a row lock.
-- Called by the submit function via the service role.
-- ------------------------------------------------------------
create or replace function submit_entry(
  p_week_id bigint,
  p_code text,
  p_reference text,
  p_first_name text,
  p_phone text,
  p_picks jsonb,
  p_tiebreak int,
  p_numbers int[],
  p_optin boolean
) returns table (entry_id bigint, reference text)
language plpgsql security definer as $$
declare
  v_status text;
  v_code_week bigint;
begin
  select status, week_id into v_status, v_code_week
    from codes where code = p_code for update;

  if not found then
    raise exception 'code_not_found';
  elsif v_code_week <> p_week_id then
    raise exception 'code_wrong_week';
  elsif v_status = 'redeemed' then
    raise exception 'code_used';
  elsif v_status = 'void' then
    raise exception 'code_void';
  end if;

  update codes set status = 'redeemed', redeemed_at = now() where code = p_code;

  return query
  insert into entries (week_id, code, reference, first_name, phone, picks, tiebreak, numbers, whatsapp_optin)
  values (p_week_id, p_code, p_reference, p_first_name, p_phone, p_picks, p_tiebreak, p_numbers, p_optin)
  returning id, entries.reference;
end $$;
