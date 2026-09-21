-- ============================================================================
-- Scheduled cleanup of abandoned guest accounts
--
-- Guest sign-in creates a real `auth.users` row, and nothing ever removed it.
-- They are cheap, but they accumulate forever and they make every count of
-- "users" meaningless — at the time of writing, 20 of the 31 accounts on the
-- project were guests.
--
-- Only anonymous accounts are touched. A registered account is never deleted
-- by a scheduled job, whatever its age.
--
-- Two guards beyond the age window:
--
--   1. A guest who still hosts a lobby is left alone. `lobbies.host_id` has no
--      delete cascade on purpose — cascading it would destroy rooms other
--      people are still playing in — so deleting such a user would fail on the
--      foreign key and abort the whole sweep.
--   2. 30 days of not signing in. A guest session that has been idle a month
--      is not coming back; anything shorter risks a player who left a tab open
--      over a holiday.
--
-- `profiles` and `player_stats` both cascade from `auth.users`, so their rows
-- go with the account and no orphan is left behind.
--
-- Scheduled ten minutes after `cleanup-stale-lobbies` rather than beside it:
-- that job frees the `host_id` references first, so a guest whose last room
-- was collected this morning becomes deletable the same morning instead of
-- waiting another day.
-- ============================================================================

begin;

create or replace function public.cleanup_stale_guests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  with dead as (
    select u.id
      from auth.users u
     where u.is_anonymous
       and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
       and not exists (select 1 from public.lobbies l where l.host_id = u.id)
  )
  delete from auth.users u
   using dead d
   where u.id = d.id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    raise notice 'cleanup_stale_guests: removed % guest accounts', v_deleted;
  end if;

  return v_deleted;
end;
$$;

-- Housekeeping, not an app capability — clients have no business calling it.
revoke all on function public.cleanup_stale_guests() from public, anon, authenticated;

-- Unscheduled first so re-running this file does not stack duplicate jobs.
select cron.unschedule('cleanup-stale-guests')
 where exists (select 1 from cron.job where jobname = 'cleanup-stale-guests');

select cron.schedule(
  'cleanup-stale-guests',
  '10 4 * * *',
  $$select public.cleanup_stale_guests()$$
);

commit;
