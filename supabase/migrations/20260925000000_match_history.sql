-- ============================================================================
-- Match history and achievements (2.11.0)
-- ============================================================================
-- Statistics were one JSON blob per player, rewritten from the browser after
-- every match: read it, add one, write it back. That shape could not tell a
-- new match from one it had already counted — every reload of a finished
-- room recorded the match again — lost one of two matches finishing at the
-- same moment, and kept nothing to build streaks, records or a history from.
--
-- From here each match is one row per player, written once through
-- `record_match`. The key is the match itself, so writing the same match
-- again changes nothing. The progress page is computed from these rows plus
-- the old totals, kept as a baseline (20260925000001_stats_baseline.sql).
--
-- game_state stays client-authoritative (see docs/security.md): a player can
-- still write whatever result they like for themselves. What the database
-- guarantees is that each match counts once and belongs to its author.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. One row per match per player
-- ----------------------------------------------------------------------------
create table if not exists public.match_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z]{2,20}$'),
  -- Identifies the match, not the room: a room plays many matches (rematches
  -- in place, Spyfall rounds), each with its own start time.
  match_key text not null check (char_length(match_key) between 1 and 200),
  result text not null check (result in ('win', 'loss')),
  mode text not null default 'multi' check (mode in ('single', 'multi')),
  duration_seconds int not null check (duration_seconds between 0 and 86400),
  -- The game's own number: boxes, discs, points, mines flagged.
  score int,
  -- Whatever a game's achievements need to know about the match.
  details jsonb not null default '{}'::jsonb,
  played_at timestamptz not null default now(),
  unique (user_id, match_key)
);

create index if not exists match_results_user_played_idx
  on public.match_results (user_id, played_at desc);

alter table public.match_results enable row level security;

revoke all on table public.match_results from anon, authenticated;
grant select on table public.match_results to authenticated;

drop policy if exists match_results_select_own on public.match_results;
create policy match_results_select_own on public.match_results
  for select to authenticated
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. record_match — the only way a row gets in
-- ----------------------------------------------------------------------------
-- Returns true when the match was new, false when it had been recorded
-- already. The author is always the caller.
create or replace function public.record_match(
  p_game text,
  p_match_key text,
  p_result text,
  p_mode text,
  p_duration_seconds int,
  p_score int,
  p_details jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.match_results
    (user_id, game, match_key, result, mode, duration_seconds, score, details)
  values (
    v_user,
    p_game,
    p_match_key,
    p_result,
    coalesce(p_mode, 'multi'),
    greatest(0, least(coalesce(p_duration_seconds, 0), 86400)),
    p_score,
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (user_id, match_key) do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke all on function public.record_match(text, text, text, text, int, int, jsonb) from public;
grant execute on function public.record_match(text, text, text, text, int, int, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Achievements a player has been awarded, and when
-- ----------------------------------------------------------------------------
-- Which achievements exist, and what earns them, is defined in the app
-- (src/achievements/). The database only remembers the moment each one was
-- first reached, so the page can date it and a toast can fire exactly once.
create table if not exists public.achievement_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null check (achievement_id ~ '^[a-z0-9_.:-]{1,64}$'),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievement_unlocks enable row level security;

revoke all on table public.achievement_unlocks from anon, authenticated;
grant select on table public.achievement_unlocks to authenticated;

drop policy if exists achievement_unlocks_select_own on public.achievement_unlocks;
create policy achievement_unlocks_select_own on public.achievement_unlocks
  for select to authenticated
  using (user_id = auth.uid());

-- Records the given achievements for the caller and returns the ones that are
-- new — the ones worth a toast.
create or replace function public.unlock_achievements(p_ids text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_new text[];
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 200 then
    raise exception 'too many achievements' using errcode = '22023';
  end if;

  with inserted as (
    insert into public.achievement_unlocks (user_id, achievement_id)
    select v_user, id from unnest(p_ids) as id
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id
  )
  select coalesce(array_agg(achievement_id), '{}') into v_new from inserted;

  return v_new;
end;
$$;

revoke all on function public.unlock_achievements(text[]) from public;
grant execute on function public.unlock_achievements(text[]) to authenticated;
