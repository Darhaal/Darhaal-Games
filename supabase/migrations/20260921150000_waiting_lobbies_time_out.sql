-- ============================================================================
-- A waiting room with nobody in it is collected within minutes, not days
--
-- `cleanup_stale_lobbies` gave every non-finished room a seven-day window,
-- which is right for a match someone may still come back to and far too
-- generous for an empty lobby: it left rooms advertising themselves in the
-- list for a week after the last person closed the tab.
--
-- Now that the lobby screen marks `last_seen_at` while anyone has it open
-- (20260921140000), emptiness is a fact the database can check rather than
-- guess at. A waiting room untouched for ten minutes has nobody in it.
--
-- `last_seen_at` only applies to waiting rooms — the ping lives in the lobby
-- screen, not the game screens — so a match in progress keeps the old rule
-- and is still judged by its last action.
--
-- The sweep moves from daily to every five minutes. A ten-minute timeout
-- checked once a day is not a timeout; the query is a single scan of a small
-- table, so the frequency costs nothing.
-- ============================================================================

begin;

create or replace function public.cleanup_stale_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  with activity as (
    select
      id,
      status,
      last_seen_at,
      coalesce(
        -- The regex guard matters: a malformed game_state must not abort the
        -- whole cleanup with a cast error.
        case
          when game_state->>'lastActionTime' ~ '^[0-9]+$'
            then to_timestamp((game_state->>'lastActionTime')::bigint / 1000.0)
        end,
        created_at
      ) as last_active
    from public.lobbies
  ),
  dead as (
    select id from activity
     where
       -- Empty lobby: nobody has had the room open for ten minutes.
       (status = 'waiting' and last_seen_at < now() - interval '10 minutes')
       -- A finished room is a scoreboard; give people a day to read it.
       or (status = 'finished' and last_active < now() - interval '1 day')
       -- Anything else — a match abandoned mid-play — keeps the long window.
       or (status not in ('waiting', 'finished') and last_active < now() - interval '7 days')
  )
  delete from public.lobbies l
   using dead d
   where l.id = d.id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    raise notice 'cleanup_stale_lobbies: removed % lobbies', v_deleted;
  end if;

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_stale_lobbies() from public, anon, authenticated;

select cron.unschedule('cleanup-stale-lobbies')
 where exists (select 1 from cron.job where jobname = 'cleanup-stale-lobbies');

select cron.schedule(
  'cleanup-stale-lobbies',
  '*/5 * * * *',
  $$select public.cleanup_stale_lobbies()$$
);

commit;
