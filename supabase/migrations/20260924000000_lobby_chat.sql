-- ============================================================================
-- Chat in every room
--
-- Messages live in their own table rather than in `game_state`, and that is
-- the decision this whole file turns on. `game_state` sits behind a
-- compare-and-swap on its version: every write bumps it, and a write made
-- against a stale version is refused and retried. Putting chat there would
-- make every message a competing write — "gl hf" would cost somebody their
-- move, the exact failure the 2.2.x write-path work spent a release removing.
-- Here a message is an insert into a table nothing else writes to.
--
-- Who can read: participants of the room, and nobody else. A room link is an
-- invitation, and a private room also has a password; being handed the link
-- must not be enough to read what the people inside have been saying.
--
-- Who can write: nobody directly. `send_lobby_message` checks the caller is
-- in the room, trims and caps the text, rate-limits, and takes the author's
-- name from the room's own roster — so a message cannot claim to come from
-- somebody else.
--
-- Retention: a message is deleted with its room, by cascade. Rooms are
-- already collected on a schedule, so chat needs no sweep of its own.
-- ============================================================================

begin;

create table if not exists public.lobby_messages (
  id          bigint generated always as identity primary key,
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  body        text not null check (char_length(body) between 1 and 300),
  created_at  timestamptz not null default now()
);

-- The only query the app makes: this room's latest messages.
create index if not exists lobby_messages_room_time
  on public.lobby_messages (lobby_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Is the caller seated in this room?
--
-- Both roster shapes, as everywhere else: an array of players for most
-- games, an object keyed by user id for Minesweeper and Battleship.
-- SECURITY DEFINER so a policy can call it without the caller needing read
-- access to columns of `lobbies` they are not otherwise granted.
-- ---------------------------------------------------------------------------
create or replace function public.is_lobby_participant(p_lobby_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.lobbies l
     where l.id = p_lobby_id
       and (
         exists (
           select 1
             from jsonb_array_elements(
                    case jsonb_typeof(l.game_state->'players')
                      when 'array' then l.game_state->'players'
                      else '[]'::jsonb
                    end
                  ) as p
            where p->>'id' = auth.uid()::text
         )
         or (
           jsonb_typeof(l.game_state->'players') = 'object'
           and l.game_state->'players' ? auth.uid()::text
         )
       )
  );
$$;

revoke all on function public.is_lobby_participant(uuid) from public, anon;
grant execute on function public.is_lobby_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
alter table public.lobby_messages enable row level security;

revoke all on public.lobby_messages from public, anon, authenticated;
grant select on public.lobby_messages to authenticated;

drop policy if exists lobby_messages_read on public.lobby_messages;
create policy lobby_messages_read on public.lobby_messages
  for select to authenticated
  using (public.is_lobby_participant(lobby_id));

-- ---------------------------------------------------------------------------
-- The only way in.
-- ---------------------------------------------------------------------------
create or replace function public.send_lobby_message(p_lobby_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_body    text;
  v_players jsonb;
  v_name    text;
  v_recent  int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) = 0 then
    return;
  end if;
  v_body := left(v_body, 300);

  select game_state->'players' into v_players
    from public.lobbies
   where id = p_lobby_id;

  if v_players is null then
    raise exception 'no such room';
  end if;

  -- The author's name comes from the room, not from the caller: it is the
  -- name everyone at the table already sees, and it cannot be chosen per
  -- message to impersonate someone.
  if jsonb_typeof(v_players) = 'array' then
    select p->>'name' into v_name
      from jsonb_array_elements(v_players) as p
     where p->>'id' = v_uid::text
     limit 1;
  elsif jsonb_typeof(v_players) = 'object' then
    v_name := v_players->v_uid::text->>'name';
  end if;

  if v_name is null then
    raise exception 'not a participant of this room';
  end if;

  -- Five in five seconds is quick conversation; more than that is a key
  -- held down, and the other players should not have to scroll past it.
  select count(*) into v_recent
    from public.lobby_messages
   where lobby_id = p_lobby_id
     and user_id = v_uid
     and created_at > now() - interval '5 seconds';

  if v_recent >= 5 then
    raise exception 'slow down';
  end if;

  insert into public.lobby_messages (lobby_id, user_id, author_name, body)
  values (p_lobby_id, v_uid, left(coalesce(nullif(btrim(v_name), ''), 'Player'), 40), v_body);
end;
$$;

revoke all on function public.send_lobby_message(uuid, text) from public, anon;
grant execute on function public.send_lobby_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new messages are pushed, and RLS decides who receives them.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'lobby_messages'
  ) then
    alter publication supabase_realtime add table public.lobby_messages;
  end if;
end;
$$;

commit;
