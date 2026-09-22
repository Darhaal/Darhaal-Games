/**
 * Who moves first.
 *
 * Every game handed the opening move to `players[0]`, which is whoever
 * created the room — so the host opened every Reversi as Dark, shot first in
 * every Battleship and took the first line in every Dots match. In a game
 * where moving first is an advantage, that is the host quietly winning a
 * coin toss they never tossed.
 *
 * Module level rather than inline in a hook: `Math.random()` in a component
 * body trips the react-compiler purity heuristic, which is the same reason
 * `now()` lives outside these hooks.
 *
 * The updater these run inside may be re-run on a version conflict, which
 * draws again. That is harmless — a different random answer is still random.
 */

/** A random index into a list of `count` items; 0 when the list is empty. */
export function randomIndex(count: number): number {
  if (count <= 1) return 0;
  return Math.floor(Math.random() * count);
}

/** A random element, or undefined when there is nothing to pick from. */
export function randomOf<T>(items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[randomIndex(items.length)];
}

/** Fisher–Yates, on a copy — the input is left alone. */
export function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
