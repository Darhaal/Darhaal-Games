import type { SonglerAttempt, SonglerRoundResult, SonglerSong, SonglerVerdict } from '@/types/songler';

/**
 * Songler's rules without a network or React: how long each snippet is, what
 * a try is worth, who takes the places, and when two names are the same
 * song. The agreed rules are docs/songler-spec.md; section numbers refer to it.
 */

// ---------------------------------------------------------------- snippets --

/** How much of the preview each try lets you hear, in seconds (section 2). */
export const SNIPPET_SECONDS = [0.5, 1, 2, 4, 8, 15] as const;
export const MAX_ATTEMPTS = SNIPPET_SECONDS.length;

/** The snippet a player has earned after `tries` tries; all of it once they are done. */
export const snippetSeconds = (tries: number, done: boolean, previewSeconds = 30) =>
  done ? previewSeconds : SNIPPET_SECONDS[Math.min(tries, MAX_ATTEMPTS - 1)];

// ----------------------------------------------------------------- matching --

/**
 * A name made comparable: lower case, no accents, ё as е, no version in
 * brackets or after a dash ("Remastered 2011", "Live"), letters and digits
 * only. The pool builder keys songs the same way.
 */
export const normalize = (s = '') => s
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\s*[([][^)\]]*[)\]]/g, ' ')
  .replace(/\s+-\s+.*$/, ' ')
  .replace(/ё/g, 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const songKey = (s: { title: string; artist: string }) => `${normalize(s.title)}|${normalize(s.artist)}`;

/** The same song — the same track, or the same title by the same artist (a remaster, a single). */
export const sameSong = (a: { id: number; title: string; artist: string }, b: { id: number; title: string; artist: string }) =>
  a.id === b.id || songKey(a) === songKey(b);

export const sameArtist = (a: { artist: string }, b: { artist: string }) => normalize(a.artist) === normalize(b.artist);

/** What a named song comes to against the answer. */
export function verdictOf(guess: { id: number; title: string; artist: string } | null, answer: SonglerSong): SonglerVerdict {
  if (!guess) return 'skip';
  if (sameSong(guess, answer)) return 'right';
  return sameArtist(guess, answer) ? 'artist' : 'wrong';
}

/** Done with the round: named the song, or out of tries. */
export const isDone = (attempts: readonly SonglerAttempt[]) =>
  attempts.length >= MAX_ATTEMPTS || attempts.some((a) => a.verdict === 'right');

// -------------------------------------------------------------------- score --

/** The song named on the first try is worth 1000, on the last 100 (section 4). */
export const ATTEMPT_POINTS = [1000, 800, 600, 400, 250, 100] as const;
/** Named the artist but never the song. */
export const ARTIST_POINTS = 100;
export const PLACE_BONUS = [100, 60, 30] as const;
export const TIME_PENALTY_MAX = 200;

/** What the time took: from the moment the round opens, evenly up to 200 at its end. */
export function timePenalty(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return Math.round(TIME_PENALTY_MAX * Math.min(1, Math.max(0, elapsedMs / durationMs)));
}

/**
 * Place bonuses: whoever named the song on the fewest tries +100, the next
 * +60, the next +30 — the same try ranked by who was quicker. Only places
 * with someone below them pay, so the last place never does and a solo
 * player sees none. A player who never named it is below everyone who did.
 */
export function placeBonuses(players: ReadonlyArray<{ id: string; solved: { on: number; at: number } | null }>): Map<string, number> {
  const out = new Map<string, number>(players.map((p) => [p.id, 0]));
  const solved = players.filter((p) => p.solved).sort((a, b) => a.solved!.on - b.solved!.on || a.solved!.at - b.solved!.at);
  const below = (i: number) => i < solved.length - 1 || solved.length < players.length;
  solved.forEach((p, i) => {
    if (i < PLACE_BONUS.length && below(i)) out.set(p.id, PLACE_BONUS[i]);
  });
  return out;
}

/** A whole round scored at once — the places need everyone's result. */
export function scoreRound(
  players: ReadonlyArray<{ id: string; attempts: readonly SonglerAttempt[] }>,
  song: SonglerSong,
  durationMs: number
): Map<string, SonglerRoundResult> {
  const solvedOf = (attempts: readonly SonglerAttempt[]) => {
    const on = attempts.findIndex((a) => a.verdict === 'right');
    return on < 0 ? null : { on, at: attempts[on].at };
  };
  const places = placeBonuses(players.map((p) => ({ id: p.id, solved: solvedOf(p.attempts) })));
  const out = new Map<string, SonglerRoundResult>();
  for (const p of players) {
    const solved = solvedOf(p.attempts);
    const artist = !solved && p.attempts.some((a) => a.verdict === 'artist');
    const base = solved ? ATTEMPT_POINTS[solved.on] : artist ? ARTIST_POINTS : 0;
    const place = places.get(p.id) ?? 0;
    const penalty = solved ? timePenalty(solved.at, durationMs) : 0;
    out.set(p.id, {
      song: song.id,
      solvedOn: solved ? solved.on : null,
      artist,
      base,
      place,
      penalty,
      score: Math.max(0, base + place - penalty),
      ...(solved ? { seconds: Math.round(solved.at / 1000) } : {})
    });
  }
  return out;
}

/** What a player's match adds up to, for the statistics and the achievements (section 9). */
export function matchDetails(history: readonly SonglerRoundResult[]) {
  const solved = history.filter((r) => r.solvedOn !== null);
  const seconds = solved.flatMap((r) => (typeof r.seconds === 'number' ? [r.seconds] : []));
  return {
    rounds: history.length,
    solved: solved.length,
    firstNote: solved.filter((r) => r.solvedOn === 0).length,
    lastChance: solved.filter((r) => r.solvedOn === MAX_ATTEMPTS - 1).length,
    artistOnly: history.filter((r) => r.artist).length,
    // Only a match where every round was named has a worst try to speak of.
    ...(history.length > 0 && solved.length === history.length ? { worstTry: Math.max(...solved.map((r) => r.solvedOn!)) } : {}),
    ...(seconds.length ? { fastest: Math.min(...seconds) } : {})
  };
}
