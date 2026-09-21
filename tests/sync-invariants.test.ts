import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Two rules about writing `game_state`, enforced against the source because
 * they cannot be enforced by types and both have already been broken.
 *
 * The write path is a compare-and-swap: `writeGameState` asks the database for
 * `version - 1` and the RPC refuses unless that matches exactly. That makes the
 * version counter load-bearing, and makes a dropped write a lost move.
 */

const HOOKS_DIR = resolve(__dirname, '../src/hooks');

const gameHooks = readdirSync(HOOKS_DIR)
  .filter((f) => f.endsWith('Game.ts'))
  .map((f) => ({ name: f, source: readFileSync(resolve(HOOKS_DIR, f), 'utf-8') }));

/** Strips comments so prose about `version:` does not trip the scan. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('game_state write invariants', () => {
  it('finds the game hooks it means to check', () => {
    expect(gameHooks.map((h) => h.name).sort()).toEqual([
      'useBattleshipGame.ts',
      'useCoupGame.ts',
      'useDotsGame.ts',
      'useFlagerGame.ts',
      'useMinesweeperGame.ts',
      'useReversiGame.ts',
      'useSpyfallGame.ts',
      'useWallRushGame.ts'
    ]);
  });

  for (const hook of gameHooks) {
    describe(hook.name, () => {
      it('never assigns version itself', () => {
        // Coup's startGame built its new state with `version: 1` after
        // spreading the current one, so starting a match reset the counter.
        // updateState then bumped it to 2 and the compare-and-swap asked the
        // database for version 1 — true only in a room nobody had joined. From
        // the moment a second player arrived the row sat at version 2 and every
        // start was refused, so the match never began and the room stranded in
        // the lobby list. Confirmed against the live database, where exactly
        // such a room was sitting.
        //
        // Only `useLobbySync` may touch this field.
        const assignments = stripComments(hook.source).match(/\bversion\s*:\s*\d/g) ?? [];
        expect(assignments, `${hook.name} assigns version`).toEqual([]);
      });

      it('writes only through the retryable form of updateState', () => {
        // The plain-object form gets one attempt: if another player writes
        // first it is abandoned and the move is lost. The functional form is
        // re-run against freshly fetched state instead. Simultaneous actions
        // are normal here — everyone votes at once in Spyfall, everyone passes
        // at once in Coup, everyone taps ready at once in Flager — so a new
        // action should take the retryable form unless there is a reason not
        // to.
        const calls = stripComments(hook.source).match(/updateState\(\s*[^\s(]/g) ?? [];
        expect(calls, `${hook.name} has a non-retryable write`).toEqual([]);
      });
    });
  }
});
