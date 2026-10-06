-- ============================================================================
-- Empty rooms close in a minute or two, abandoned matches in half an hour
--
-- A waiting room whose host closed the tab sat in the list for up to fifteen
-- minutes — ten without a ping, then up to five more until the sweep — and
-- anyone who joined it was dropped fifteen seconds later, when their client
-- removed the absent host. A match everyone had left was judged by its last
-- move and kept for seven days.
--
-- 1. A closing tab says so: `touch_lobby(id, true)` moves a waiting room's
--    `last_seen_at` to a minute short of the timeout. Anyone still in the
--    room pings within thirty seconds and puts it back; a reload pings on
--    load. A sleeping laptop or a phone in another app sends nothing, and
--    keeps the full ten minutes.
-- 2. The list may read `last_seen_at`, so it can hide a waiting room nobody
--    has open before the sweep gets to it.
-- 3. The game screens ping too now (useLobbySync), so a match is alive while
--    anyone has it open: one with no ping and no move for thirty minutes is
--    abandoned. The last move still counts, so a client from before this
--    change is judged as before.
-- 4. The sweep runs every minute.
-- ============================================================================

begin;

drop function if exists public.touch_lobby(uuid);

create or replace function public.touch_lobby(p_lobby_id uuid, p_leaving boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players jsonb;
begin
  select game_state->'players' into v_players
    from public.lobbies
   where id = p_lobby_id;

  if v_players is null then
    return;  -- no such room; nothing to keep alive
  end if;

  -- Both roster shapes, as elsewhere: an array for most games, an object
  -- keyed by user id for Minesweeper and Battleship.
  if not (
    exists (
      select 1
      from jsonb_array_elements(
             case jsonb_typeof(v_players) when 'array' then v_players else '[]'::jsonb end
           ) as p
      where p->>'id' = auth.uid()::text
    )
    or (jsonb_typeof(v_players) = 'object' and v_players ? auth.uid()::text)
  ) then
    return;  -- not in this room; silently ignore rather than leak its existence
  end if;

  if p_leaving then
    -- A minute before the sweep would take it, never later than it already is.
    update public.lobbies
       set last_seen_at = least(last_seen_at, now() - interval '9 minutes')
     where id = p_lobby_id
       and status = 'waiting';
  else
    update public.lobbies
       set last_seen_at = now()
     where id = p_lobby_id;
  end if;
end;
$$;

revoke all on function public.touch_lobby(uuid, boolean) from public, anon;
grant execute on function public.touch_lobby(uuid, boolean) to authenticated;

grant select (last_seen_at) on public.lobbies to anon, authenticated;

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
       -- Empty lobby: nobody has had the room open for ten minutes (one, after
       -- the last tab closed — see touch_lobby).
       (status = 'waiting' and last_seen_at < now() - interval '10 minutes')
       -- A finished room is a scoreboard; give people a day to read it.
       or (status = 'finished' and last_active < now() - interval '1 day')
       -- A match nobody has open and nobody has moved in for half an hour.
       or (status not in ('waiting', 'finished')
           and greatest(last_seen_at, last_active) < now() - interval '30 minutes')
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
  '* * * * *',
  $$select public.cleanup_stale_lobbies()$$
);

commit;
