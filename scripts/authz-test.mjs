/**
 * End-to-end authorization test against the live database, driven through the
 * public anon key exactly as the browser would.
 *
 * Two throwaway guest sessions are created; guest B attempts to tamper with
 * guest A's lobby. Real lobbies are never targeted, and both guests are
 * deleted at the end using the service_role key (profiles and player_stats
 * follow via ON DELETE CASCADE).
 *
 * Run from the project root:  node scripts/authz-test.mjs
 * Exits non-zero if any check fails, so it can gate a deploy.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const pass = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(52)} ${detail}`);
};

const code = () => Array.from({ length: 6 }, () =>
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

const A = client();
const B = client();
const { data: aAuth } = await A.auth.signInAnonymously();
const { data: bAuth } = await B.auth.signInAnonymously();
const aId = aAuth.user.id;
const bId = bAuth.user.id;
console.log('guest A:', aId.slice(0, 8), ' guest B:', bId.slice(0, 8), '\n');

const baseState = {
  players: [{ id: aId, name: 'A', isHost: true }],
  status: 'waiting', version: 1, gameType: 'coup', lastActionTime: Date.now()
};

// --- A creates a lobby in its own name ---
const { data: lobby, error: insErr } = await A.from('lobbies')
  .insert({ code: code(), name: 'authz-test', host_id: aId, is_private: false, status: 'waiting', game_state: baseState })
  .select('id').single();
pass('A can create a lobby in its own name', !insErr && !!lobby, insErr?.message ?? '');
if (!lobby) process.exit(1);

// --- a bare .select() means `*`, which needs SELECT on the revoked password
//     column. This is a real regression that shipped once: the create page
//     used .select() and every lobby creation failed with 42501. Keep the
//     constraint asserted so nobody reintroduces the star.
{
  const { error } = await A.from('lobbies')
    .insert({ code: code(), name: 'star-select', host_id: aId, is_private: false, status: 'waiting', game_state: baseState })
    .select().single();
  // INSERT ... RETURNING * is one statement, so the privilege failure rolls
  // the insert back too — no stray row to clean up.
  pass('a bare .select() on lobbies is denied (use columns)', error?.code === '42501',
    error ? (error.code ?? '') : 'STAR SELECT SUCCEEDED — password may be readable');
}

// --- B tries to create a lobby impersonating A ---
{
  const { error } = await B.from('lobbies')
    .insert({ code: code(), name: 'spoof', host_id: aId, is_private: false, status: 'waiting', game_state: baseState });
  pass('B cannot create a lobby owned by A', !!error, error ? (error.code ?? '') : 'INSERT SUCCEEDED');
}

// --- B tries to delete A's lobby directly ---
{
  const { error } = await B.from('lobbies').delete().eq('id', lobby.id);
  const { data: still } = await A.from('lobbies').select('id').eq('id', lobby.id).maybeSingle();
  pass('B cannot DELETE A\'s lobby directly', !!still, error ? (error.code ?? '') : (still ? 'blocked, row intact' : 'ROW DESTROYED'));
}

// --- B tries to rewrite A's game_state directly ---
{
  const { error } = await B.from('lobbies').update({ game_state: { hacked: true } }).eq('id', lobby.id);
  const { data: row } = await A.from('lobbies').select('game_state').eq('id', lobby.id).single();
  const intact = row?.game_state?.hacked === undefined;
  pass('B cannot rewrite A\'s game_state', intact, error ? (error.code ?? '') : (intact ? 'blocked' : 'STATE OVERWRITTEN'));
}

// --- B tries to read the password column ---
{
  const { error } = await B.from('lobbies').select('password').limit(1);
  pass('B cannot read lobbies.password', !!error, error?.code ?? 'READABLE');
}

// --- touch_lobby: a closing tab hands the room a minute's grace; only a
//     participant can say so, and the next ping takes it back ---
{
  const seen = async () => new Date((await A.from('lobbies').select('last_seen_at').eq('id', lobby.id).single()).data.last_seen_at).getTime();
  await B.rpc('touch_lobby', { p_lobby_id: lobby.id, p_leaving: true });
  const afterStranger = Date.now() - await seen();
  pass('touch_lobby ignores a leaving non-participant', afterStranger < 2 * 60_000, `${Math.round(afterStranger / 1000)} s ago`);
  await A.rpc('touch_lobby', { p_lobby_id: lobby.id, p_leaving: true });
  const afterLeaving = Date.now() - await seen();
  pass('touch_lobby leaving leaves a minute to the sweep', afterLeaving > 8.5 * 60_000 && afterLeaving < 10 * 60_000, `${Math.round(afterLeaving / 1000)} s ago`);
  await A.rpc('touch_lobby', { p_lobby_id: lobby.id });
  const afterPing = Date.now() - await seen();
  pass('a ping takes the room back', afterPing < 60_000, `${Math.round(afterPing / 1000)} s ago`);
}

// --- B calls leave_lobby on a room it does not belong to ---
{
  const { data, error } = await B.rpc('leave_lobby', { p_lobby_id: lobby.id });
  const { data: still } = await A.from('lobbies').select('id').eq('id', lobby.id).maybeSingle();
  pass('leave_lobby refuses a non-participant', data === false && !!still, error?.message ?? `returned ${data}`);
}

// --- A (the host) closes its own room ---
{
  const { data, error } = await A.rpc('leave_lobby', { p_lobby_id: lobby.id });
  const { data: gone } = await A.from('lobbies').select('id').eq('id', lobby.id).maybeSingle();
  pass('leave_lobby lets the host close the room', data === true && !gone, error?.message ?? `returned ${data}`);
}

// --- match history: one row per match, written only through record_match ---
{
  const record = (who, key, result = 'win') => who.rpc('record_match', {
    p_game: 'dots', p_match_key: key, p_result: result, p_mode: 'multi',
    p_duration_seconds: 120, p_score: 7, p_details: { boxesTotal: 25 }
  });
  const key = `authz-test:${Date.now()}`;

  const first = await record(A, key);
  pass('record_match records a new match', first.data === true, first.error?.message ?? `returned ${first.data}`);

  const again = await record(A, key, 'loss');
  const { data: rows } = await A.from('match_results').select('result').eq('match_key', key);
  pass('the same match recorded twice counts once', again.data === false && rows?.length === 1 && rows[0].result === 'win',
    again.error?.message ?? `returned ${again.data}, ${rows?.length} row(s)`);

  const { data: peek } = await B.from('match_results').select('id').eq('user_id', aId);
  pass('B cannot read A\'s match history', (peek ?? []).length === 0, `${(peek ?? []).length} row(s) visible`);

  const { error: direct } = await B.from('match_results').insert({
    user_id: aId, game: 'dots', match_key: 'forged', result: 'win', duration_seconds: 1
  });
  pass('nobody inserts into match_results directly', !!direct, direct?.code ?? 'INSERT SUCCEEDED');

  const bad = await record(B, `authz-test:bad:${Date.now()}`, 'draw');
  pass('record_match rejects a result it does not know', !!bad.error, bad.error?.code ?? 'ACCEPTED');
}

// --- achievements: stored through unlock_achievements, new ones reported once ---
{
  const first = await A.rpc('unlock_achievements', { p_ids: ['dots.wins:bronze', 'matches:bronze'] });
  const again = await A.rpc('unlock_achievements', { p_ids: ['dots.wins:bronze', 'wins:bronze'] });
  pass('unlock_achievements returns only what is new',
    JSON.stringify([...(first.data ?? [])].sort()) === '["dots.wins:bronze","matches:bronze"]' &&
    JSON.stringify(again.data) === '["wins:bronze"]',
    first.error?.message ?? again.error?.message ?? `${JSON.stringify(first.data)} then ${JSON.stringify(again.data)}`);

  const { data: peek } = await B.from('achievement_unlocks').select('achievement_id').eq('user_id', aId);
  pass('B cannot read A\'s achievements', (peek ?? []).length === 0, `${(peek ?? []).length} row(s) visible`);

  const { error: direct } = await B.from('achievement_unlocks').insert({ user_id: aId, achievement_id: 'forged' });
  pass('nobody inserts into achievement_unlocks directly', !!direct, direct?.code ?? 'INSERT SUCCEEDED');
}

// --- profiles: clients write their name and avatar, nothing else ---
{
  const { error: emailErr } = await A.from('profiles').update({ email: 'forged@test.invalid' }).eq('id', aId);
  pass('nobody rewrites their profile email', !!emailErr, emailErr?.code ?? 'UPDATE SUCCEEDED');

  const { error: nameErr } = await A.from('profiles').update({ username: `authz-${aId.slice(0, 6)}` }).eq('id', aId);
  pass('a player can rename themselves', !nameErr, nameErr?.message ?? '');

  const { data: guestsName, error: takenErr } = await B.rpc('username_taken', { p_username: 'player' });
  pass('a guest name does not count as taken', guestsName === false, takenErr?.message ?? `returned ${guestsName}`);
}

// --- delete_my_account: B removes itself, A's room stays untouched ---
let bDeleted = false;
{
  const { data: room } = await A.from('lobbies')
    .insert({ code: code(), name: 'authz-test', host_id: aId, is_private: false, status: 'waiting', game_state: baseState })
    .select('id').single();
  const { error } = await B.rpc('delete_my_account');
  const { data: profile } = await A.from('profiles').select('id').eq('id', bId).maybeSingle();
  const { data: stillThere } = await A.from('lobbies').select('id').eq('id', room?.id).maybeSingle();
  bDeleted = !error && !profile;
  pass('delete_my_account removes the caller', bDeleted, error?.message ?? (profile ? 'profile still there' : ''));
  pass('… and only the caller', !!stillThere, stillThere ? '' : 'A\'s room was deleted');
  const { error: hostErr } = await A.rpc('delete_my_account');
  const { data: roomAfter } = await A.from('lobbies').select('id').eq('id', room?.id).maybeSingle();
  pass('a host deleting the account takes its rooms along', !hostErr && !roomAfter, hostErr?.message ?? (roomAfter ? 'room left behind' : ''));
}

// --- clean up: remove the throwaway guests that are left ---
// profiles, player_stats, match_results and achievement_unlocks follow via ON DELETE CASCADE.
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const { data: aLeft } = await admin.auth.admin.getUserById(aId);
for (const id of [aLeft?.user ? aId : null, bDeleted ? null : bId].filter(Boolean)) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) console.log(`  cleanup failed for ${id}: ${error.message}`);
}
console.log('\ntest guests removed.');

if (failures > 0) {
  console.error(`\n${failures} authorization check(s) FAILED`);
  process.exit(1);
}
console.log('all authorization checks passed.');
