-- ============================================================================
-- Rematch: a finished room spawns exactly one successor
--
-- "Play again" used to reset the finished room in place. That is wrong for a
-- room people arrived at by link: the results vanish from under anyone still
-- reading them, and the room keeps its old identity forever.
--
-- A rematch is a new room instead, inheriting the parent's settings. Two
-- things make that awkward from the client, and both are why this is a
-- function rather than an insert:
--
--   1. `lobbies.password` is not readable by clients (v2.1 hardening), so a
--      private room's password cannot be copied client-side at all.
--   2. Both players press the button. Whoever is second must land in the
--      *same* successor, not create a third room.
--
-- Locking the parent and storing the successor's id on it settles both: the
-- first caller creates, every later caller is handed the same id back.
-- ============================================================================

begin;

create or replace function public.create_rematch_lobby(
  p_parent uuid,
  p_code text,
  p_state jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.lobbies%rowtype;
  v_existing uuid;
  v_new uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- FOR UPDATE is the whole race guard: the second presser waits here and
  -- then finds the successor already recorded.
  select * into v_parent from public.lobbies where id = p_parent for update;
  if not found then
    raise exception 'lobby not found';
  end if;

  -- Only someone who was at the table may start its rematch. Player lists are
  -- an array of objects in some games and an object keyed by id in others, so
  -- both shapes are checked.
  if not (
    exists (
      select 1
      from jsonb_array_elements(
             case jsonb_typeof(v_parent.game_state->'players')
               when 'array' then v_parent.game_state->'players'
               else '[]'::jsonb
             end
           ) as p
      where p->>'id' = auth.uid()::text
    )
    or (
      jsonb_typeof(v_parent.game_state->'players') = 'object'
      and v_parent.game_state->'players' ? auth.uid()::text
    )
  ) then
    raise exception 'not a participant of this lobby';
  end if;

  -- Already started by the other player, and still alive.
  v_existing := nullif(v_parent.game_state->>'rematchLobbyId', '')::uuid;
  if v_existing is not null
     and exists (select 1 from public.lobbies where id = v_existing) then
    return v_existing;
  end if;

  -- Settings ride along: a private room stays private with the same password,
  -- a public one stays public.
  insert into public.lobbies (code, name, host_id, is_private, password, status, game_state)
  values (
    p_code,
    v_parent.name,
    auth.uid(),
    v_parent.is_private,
    v_parent.password,
    'waiting',
    p_state
  )
  returning id into v_new;

  update public.lobbies
     set game_state = jsonb_set(game_state, '{rematchLobbyId}', to_jsonb(v_new::text))
   where id = p_parent;

  return v_new;
end;
$$;

revoke all on function public.create_rematch_lobby(uuid, text, jsonb) from public;
grant execute on function public.create_rematch_lobby(uuid, text, jsonb) to anon, authenticated;

commit;
