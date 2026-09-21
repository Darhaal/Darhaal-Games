-- ============================================================================
-- A lobby nobody has open times out
--
-- The auto-kick in the lobby screen is run *by the host* and never kicks
-- itself, so it only ever removes other people. When the host closed their
-- tab there was nothing watching the room at all: the roster kept whoever was
-- listed, the room advertised itself as full, and the stale sweep left a
-- `waiting` room alone for seven days. A real example: a two-player Battleship
-- room sat at 2/2 for hours after both players had gone on to play elsewhere.
--
-- Realtime presence knows who is there, but it lives in the Realtime service
-- and SQL cannot see it. So the lobby screen leaves a mark in the row instead:
-- `last_seen_at`, refreshed while anyone has the lobby open. A `waiting` room
-- nobody has touched for ten minutes has nobody in it, whatever its roster
-- says.
--
-- Ten minutes against a thirty-second ping is twenty missed beats — a margin
-- wide enough that a reload, a sleeping laptop or a slow network cannot get a
-- room anyone is actually sitting in deleted.
--
-- The client half of this is the host handover in UniversalLobby: if the host
-- goes and other players remain, one of them takes the room over, so the room
-- keeps being touched and survives. This timeout is for when the last person
-- leaves.
-- ============================================================================

begin;

alter table public.lobbies
  add column if not exists last_seen_at timestamptz not null default now();

-- Clients may not write the column directly — they have no UPDATE grant on it
-- and are not getting one. The RPC is the only way in, and it checks the
-- caller is actually in the room, so a lobby cannot be kept alive from outside.
create or replace function public.touch_lobby(p_lobby_id uuid)
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

  update public.lobbies
     set last_seen_at = now()
   where id = p_lobby_id;
end;
$$;

revoke all on function public.touch_lobby(uuid) from public, anon;
grant execute on function public.touch_lobby(uuid) to authenticated;

commit;
