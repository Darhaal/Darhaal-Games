-- ============================================================================
-- Statistics baseline (2.11.0) — apply when the 2.11 client is deployed
-- ============================================================================
-- Split from 20260925000000_match_history.sql because it has to land together
-- with the client: the 2.10 client still rewrites player_stats after every
-- match, and would both fail on the revoke below and write the old shapes
-- back into the rows this cleans.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The old totals become a baseline
-- ----------------------------------------------------------------------------
-- `details` held two shapes per game — flat `{wins, lost, time}` and, for
-- games with a solo mode, `{single, multi}` — and for one player both at once,
-- so ten matches were stored but never shown. It also still carried a game
-- that no longer exists. From here it is read as a baseline and no longer
-- written: one flat record per current game, every shape folded in, `time`
-- still in minutes as it was recorded; total_games made to agree with it.
with games(game) as (
  values ('spyfall'), ('minesweeper'), ('flager'), ('battleship'),
         ('coup'), ('wallrush'), ('dots'), ('reversi')
),
folded as (
  select
    s.user_id,
    g.game,
    coalesce((d->>'wins')::int, 0) + coalesce((d->'single'->>'wins')::int, 0) + coalesce((d->'multi'->>'wins')::int, 0) as wins,
    coalesce((d->>'lost')::int, 0) + coalesce((d->'single'->>'lost')::int, 0) + coalesce((d->'multi'->>'lost')::int, 0) as lost,
    coalesce((d->>'time')::int, 0) + coalesce((d->'single'->>'time')::int, 0) + coalesce((d->'multi'->>'time')::int, 0) as time,
    coalesce((d->>'extra')::int, 0) + coalesce((d->'single'->>'extra')::int, 0) + coalesce((d->'multi'->>'extra')::int, 0) as extra
  from public.player_stats s
  cross join games g
  left join lateral (select s.details -> g.game as d) x on true
),
rebuilt as (
  select
    user_id,
    jsonb_object_agg(game, jsonb_build_object('wins', wins, 'lost', lost, 'time', time, 'extra', extra)) as details,
    sum(wins + lost)::int as total
  from folded
  group by user_id
)
update public.player_stats s
   set details = r.details,
       total_games = r.total,
       updated_at = now()
  from rebuilt r
 where r.user_id = s.user_id;

-- Nothing writes player_stats from the app any more.
revoke update on table public.player_stats from authenticated;

comment on table public.player_stats is
  'Totals recorded before match history (2.11.0). Read-only baseline; new matches live in match_results.';
