-- ============================================================================
-- The signup trigger stops sending user ids to api.dicebear.com
--
-- 20260821000000_default_avatars.sql gave every new profile a fallback avatar
-- and ended with "this mirrors defaultAvatar() in src/constants/app.ts — keep
-- the two in sync". They then drifted: the app moved to its own /avatar/[seed]
-- route, which renders the same artwork locally from the dicebear npm package,
-- while the trigger kept writing the api.dicebear.com URL.
--
-- So every account created since has had a third-party URL stored in
-- profiles.avatar_url with the Supabase user id inside it, and any client
-- rendering that stored value made a request carrying that id off-site. The
-- 2.2.0 release notes said avatars no longer call a third party; that was true
-- of the app's own rendering path and untrue of what the database wrote.
--
-- The fallback now matches defaultAvatar() exactly: `/avatar/<user id>`.
-- ============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Player'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username', 'Player'),
    new.email,
    -- Providers use different keys; fall back to our own avatar route, which
    -- is what defaultAvatar() in src/constants/app.ts produces.
    coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      nullif(new.raw_user_meta_data->>'picture', ''),
      '/avatar/' || new.id
    )
  );
  return new;
end;
$$;

-- Existing rows keep pointing off-site until they are rewritten. The seed in
-- the old URL is the user id, so the replacement is exact rather than a guess.
update public.profiles
   set avatar_url = '/avatar/' || id
 where avatar_url like '%api.dicebear.com%';

commit;
