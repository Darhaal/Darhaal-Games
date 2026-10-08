-- ============================================================================
-- Account settings: delete your account, unique names, email kept in sync
--
-- 1. delete_my_account(). The privacy policy has said since 2.2 that an
--    account can be deleted from the profile settings; there was no such
--    button and nothing a client could call. Profiles, stats, match history,
--    achievements and chat messages all cascade from auth.users. Rooms the
--    player hosts are removed first: lobbies.host_id has no delete action on
--    purpose (see 20260921130000_cleanup_stale_guests.sql), so the delete
--    would otherwise fail on the foreign key.
--
-- 2. A registered player's name is theirs. Sign-up checked for a taken name,
--    renaming in the settings did not, and get_login_email() resolved a
--    username with `limit 1` — so renaming yourself to someone else's name
--    could send their username sign-in to your address. Now:
--      - username_taken(name) answers the forms, case-insensitively, and only
--        counts registered players (twenty-seven guests share "Player");
--      - a trigger refuses a rename onto a registered player's name, and on
--        sign-up (Google brings its own display name) adds a short suffix
--        instead of failing the whole sign-up;
--      - get_login_email() matches registered players only, exact case first.
--
-- 3. profiles.email follows auth.users.email. It was written once, at sign-up,
--    so a guest who adds an email (keeping their progress) or a player who
--    changes theirs would have kept signing in by username to a stale or
--    empty address. Clients also lose UPDATE on email, id and created_at:
--    the table-level grant covered every column, so anyone could rewrite
--    their own row's email.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Delete your own account
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from public.lobbies where host_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Unique names among registered players
-- ----------------------------------------------------------------------------
create or replace function public.username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles p
      join auth.users u on u.id = p.id
     where not u.is_anonymous
       and lower(btrim(p.username)) = lower(btrim(p_username))
       and p.id is distinct from auth.uid()
  );
$$;

revoke all on function public.username_taken(text) from public;
grant execute on function public.username_taken(text) to anon, authenticated;

create or replace function public.enforce_unique_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taken boolean;
begin
  if new.username is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and lower(btrim(new.username)) = lower(btrim(coalesce(old.username, ''))) then
    return new;
  end if;

  select exists (
    select 1
      from public.profiles p
      join auth.users u on u.id = p.id
     where not u.is_anonymous
       and p.id <> new.id
       and lower(btrim(p.username)) = lower(btrim(new.username))
  ) into v_taken;

  if not v_taken then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Sign-up must not fail over a display name the player did not type
    new.username := left(btrim(new.username), 11) || '-' || left(new.id::text, 4);
    return new;
  end if;

  raise exception 'username taken' using errcode = '23505';
end;
$$;

revoke all on function public.enforce_unique_username() from public, anon, authenticated;

drop trigger if exists profiles_unique_username on public.profiles;
create trigger profiles_unique_username
  before insert or update of username on public.profiles
  for each row execute function public.enforce_unique_username();

create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select p.email
    from public.profiles p
    join auth.users u on u.id = p.id
   where not u.is_anonymous
     and (lower(p.username) = lower(btrim(p_username))
          or (p.username is null and p.full_name = btrim(p_username)))
   order by (p.username = btrim(p_username)) desc, u.created_at
   limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. profiles.email follows the account's email
-- ----------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;

-- A table-level grant covers every column, so narrow it to what clients write
revoke update on public.profiles from authenticated;
grant update (username, full_name, avatar_url) on public.profiles to authenticated;

commit;
