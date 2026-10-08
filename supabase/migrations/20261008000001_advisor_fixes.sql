-- ============================================================================
-- What Supabase's security and performance advisors flagged (2026-10-07)
--
-- 1. Signed-out visitors could call RPCs that only a seated player has any
--    business calling. Guests are signed in (role `authenticated`), so the
--    `anon` role needs exactly two: get_login_email (signing in by username)
--    and username_taken (checking a name on the sign-up form). The trigger
--    functions are callable by nobody — a trigger fires without EXECUTE.
--
-- 2. RLS policies called auth.uid() once per row. Wrapped in a sub-select it
--    is evaluated once per statement; the result is identical.
--
-- 3. Two foreign keys without an index, both on hot paths since the account
--    work: lobbies.host_id (delete_my_account, the guest sweep) and
--    lobby_messages.user_id (cascade when an account is deleted).
--
-- Not changed on purpose: anonymous sign-ins (guest mode), the authenticated
-- RPCs (they are the app's API and check the caller themselves), and the
-- events / groups / group_members / personal_schedule tables (another
-- project's, empty, RLS on with no grants).
-- ============================================================================

begin;

-- 1. Who may call what ---------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_user_stats() from public, anon, authenticated;

revoke execute on function public.create_rematch_lobby(uuid, text, jsonb) from public, anon;
revoke execute on function public.join_lobby_check(uuid, text) from public, anon;
revoke execute on function public.leave_lobby(uuid) from public, anon;
revoke execute on function public.record_match(text, text, text, text, integer, integer, jsonb) from public, anon;
revoke execute on function public.unlock_achievements(text[]) from public, anon;
revoke execute on function public.update_game_state(uuid, integer, jsonb, text) from public, anon;

grant execute on function public.create_rematch_lobby(uuid, text, jsonb) to authenticated;
grant execute on function public.join_lobby_check(uuid, text) to authenticated;
grant execute on function public.leave_lobby(uuid) to authenticated;
grant execute on function public.record_match(text, text, text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.unlock_achievements(text[]) to authenticated;
grant execute on function public.update_game_state(uuid, integer, jsonb, text) to authenticated;

-- 2. auth.uid() once per statement ----------------------------------------------
alter policy achievement_unlocks_select_own on public.achievement_unlocks using (user_id = (select auth.uid()));
alter policy match_results_select_own on public.match_results using (user_id = (select auth.uid()));
alter policy lobbies_insert on public.lobbies with check (host_id = (select auth.uid()));
alter policy "Users can update own stats" on public.player_stats using ((select auth.uid()) = user_id);
alter policy player_stats_select_own on public.player_stats using ((select auth.uid()) = user_id);
alter policy profiles_update_own on public.profiles using ((select auth.uid()) = id);

-- 3. Indexes for the foreign keys that are now walked --------------------------
create index if not exists lobbies_host_id_idx on public.lobbies (host_id);
create index if not exists lobby_messages_user_id_idx on public.lobby_messages (user_id);

commit;
