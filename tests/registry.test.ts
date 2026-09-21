import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GAMES, GAME_IDS, getGame, isGameId, requireGame, roomCapacity, playerRange
} from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import { GAME_OPTIONS, defaultOptionValues } from '@/games/options';
import { createInitialState, createRematchState } from '@/games/initialState';
import { GAME_RULES } from '@/constants/rules';
import { GAMES_CONTENT, getGameContent } from '@/content/games';

/**
 * Adding a game used to mean remembering ten separate places: the create
 * screen, the lobby list, the achievements grid, the lobby header, the route,
 * the rulebook, the SEO content and the stats writer. Forgetting one produced
 * a half-registered game that still rendered — an unlabelled statistics card,
 * a rules button opening an empty dialog, another game's icon in the lobby
 * list.
 *
 * The registry makes most of those a type error. These tests cover the rest:
 * the files and prose that TypeScript cannot see.
 */

const LOCALES = ['ru', 'en'] as const;
const REPO_ROOT = resolve(__dirname, '..');

/** Player counts live in two shapes across the games; both are seated lists. */
const seatCount = (players: unknown): number =>
  Array.isArray(players) ? players.length : Object.keys(players as object).length;

describe('game registry', () => {
  it('has unique, slug-shaped ids', () => {
    expect(new Set(GAME_IDS).size).toBe(GAME_IDS.length);
    for (const id of GAME_IDS) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('matches the registry list to the exported definitions', () => {
    expect(GAMES.map((g) => g.id)).toEqual([...GAME_IDS]);
  });

  it('recognises its own ids and nothing else', () => {
    for (const id of GAME_IDS) {
      expect(isGameId(id)).toBe(true);
      expect(getGame(id)?.id).toBe(id);
    }
    // The lobby list used to default an unknown type to Coup; these must miss.
    for (const bogus of ['mafia', 'COUP', '', undefined, null]) {
      expect(isGameId(bogus)).toBe(false);
      expect(getGame(bogus)).toBeUndefined();
    }
  });

  it('throws on an id that is a typo in our own source', () => {
    // requireGame is for literals we wrote, so a miss is a bug, not bad data.
    expect(() => requireGame('mafia' as never)).toThrow(/Unknown game id/);
  });

  for (const game of GAMES) {
    describe(game.id, () => {
      it('declares a sane player range', () => {
        expect(game.players.min).toBeGreaterThanOrEqual(1);
        expect(game.players.max).toBeGreaterThanOrEqual(game.players.min);
        expect(playerRange(game)).toBe(
          game.players.min === game.players.max
            ? `${game.players.min}`
            : `${game.players.min}–${game.players.max}`
        );
      });

      it('is named and described in both languages', () => {
        for (const locale of LOCALES) {
          expect(game.name[locale].length).toBeGreaterThan(0);
          expect(game.tagline[locale].length).toBeGreaterThan(0);
          expect(game.genre[locale].length).toBeGreaterThan(0);
        }
      });

      it('carries an icon and an accent the cards can paint with', () => {
        expect(GAME_ICONS[game.id]).toBeTruthy();
        expect(game.accent).toMatch(/^#[0-9a-f]{6}$/i);
        expect(game.tint).toContain('bg-');
      });

      it('has a playable route', () => {
        // The create screen and the lobby list both navigate to /game/<id>.
        expect(existsSync(resolve(REPO_ROOT, `src/app/game/${game.id}/page.tsx`))).toBe(true);
      });

      it('has a rulebook in both languages', () => {
        for (const locale of LOCALES) {
          const rules = GAME_RULES[locale][game.id];
          expect(rules, `${game.id} ${locale}`).toBeTruthy();
          expect(rules.title.length).toBeGreaterThan(0);
          expect(rules.sections.length).toBeGreaterThan(0);
        }
      });

      it('has public content that agrees with the registry', () => {
        const content = getGameContent(game.id);
        expect(content, `${game.id} has no entry in GAMES_CONTENT`).toBeTruthy();
        expect(content!.players).toEqual(game.players);
        expect(content!.accent).toBe(game.accent);
        expect(content!.playtimeMinutes).toBe(game.playtimeMinutes);

        for (const locale of LOCALES) {
          const copy = content!.locales[locale];
          expect(copy.name).toBe(game.name[locale]);
          expect(copy.tagline).toBe(game.tagline[locale]);
          // Empty prose renders as a blank section on a page Google indexes.
          expect(copy.metaTitle.length).toBeGreaterThan(0);
          expect(copy.metaDescription.length).toBeGreaterThan(0);
          expect(copy.intro.length).toBeGreaterThan(0);
          expect(copy.howToPlay.length).toBeGreaterThan(0);
          expect(copy.faq.length).toBeGreaterThan(0);
        }
      });

      it('declares options whose defaults are actually selectable', () => {
        const keys = GAME_OPTIONS[game.id].map((o) => o.key);
        expect(new Set(keys).size, `${game.id} has a duplicate option key`).toBe(keys.length);

        for (const option of GAME_OPTIONS[game.id]) {
          for (const locale of LOCALES) expect(option.label[locale].length).toBeGreaterThan(0);

          if (option.kind === 'slider') {
            expect(option.min).toBeLessThan(option.max);
            expect(option.default).toBeGreaterThanOrEqual(option.min);
            expect(option.default).toBeLessThanOrEqual(option.max);
          } else {
            expect(option.choices.length).toBeGreaterThan(0);
            expect(option.choices.some((c) => c.value === option.default)).toBe(true);
          }
        }
      });

      it('opens a rematch room with the same settings and nobody in it', () => {
        // A rematch is a new room, so it inherits the settings but starts
        // empty: players arrive through the usual join, which is what lets the
        // second person press "play again" and land in the same room.
        const host = { id: 'host-1', name: 'Host', avatarUrl: '/avatar/host-1' };
        const parent = createInitialState(game.id, host, game.players.max, defaultOptionValues(game.id));
        const again = createRematchState(game.id, parent);

        expect(seatCount(again.players), `${game.id} seats somebody`).toBe(0);
        expect(again.status).toBe('waiting');
        expect(again.gameType).toBe(game.id);
        // A brand-new row starts at 1; it is not an update to an existing one.
        expect(again.version).toBe(1);
        expect(again.settings).toEqual(parent.settings);
      });

      it('builds a starting state the host is already seated in', () => {
        const host = { id: 'host-1', name: 'Host', avatarUrl: '/avatar/host-1' };
        const state = createInitialState(game.id, host, game.players.max, defaultOptionValues(game.id));

        expect(state.gameType).toBe(game.id);
        expect(state.status).toBe('waiting');
        expect(state.version).toBe(1);
        expect(seatCount(state.players)).toBe(1);
        // Every screen reads settings.maxPlayers to decide whether a room is
        // full, so a state without one silently falls back to a default.
        expect(state.settings.maxPlayers).toBeGreaterThanOrEqual(game.players.min);
        expect(state.settings.maxPlayers).toBeLessThanOrEqual(game.players.max);
      });
    });
  }

  it('publishes exactly the registered games, in the same order', () => {
    expect(GAMES_CONTENT.map((c) => c.slug)).toEqual([...GAME_IDS]);
  });

  describe('room capacity', () => {
    const spyfall = requireGame('spyfall');

    it('honours the cap the host chose', () => {
      expect(roomCapacity(spyfall, 5)).toBe(5);
    });

    it('falls back to the game maximum when the room stored none', () => {
      // Four of the five game screens used to pass the game maximum straight
      // through, so a room created for three advertised six seats.
      expect(roomCapacity(spyfall, undefined)).toBe(spyfall.players.max);
      expect(roomCapacity(spyfall, Number.NaN)).toBe(spyfall.players.max);
    });

    it('clamps a stored value the game cannot honour', () => {
      expect(roomCapacity(spyfall, 99)).toBe(spyfall.players.max);
      expect(roomCapacity(spyfall, 1)).toBe(spyfall.players.min);
    });
  });

  describe('starting states', () => {
    const host = { id: 'host-1', name: 'Host', avatarUrl: '/avatar/host-1' };

    it('passes the chosen options through to the state', () => {
      const state = createInitialState('minesweeper', host, 4, {
        size: 30,
        mineDensity: 20,
        timeLimitMinutes: 5
      });

      expect(state.settings).toMatchObject({
        width: 30,
        height: 30,
        minesCount: Math.floor(900 * 0.2),
        timeLimit: 300
      });
    });

    it('always leaves room for the first click', () => {
      // The first reveal opens a 3x3 safe pocket, so a maximum-density board
      // still has to keep nine cells free or the opening move is impossible.
      const state = createInitialState('minesweeper', host, 1, { size: 10, mineDensity: 100 });
      expect(state.settings.minesCount).toBe(100 - 9);
    });

    it('seats Battleship for exactly two whatever it is handed', () => {
      const state = createInitialState('battleship', host, 6, {});
      expect(state.settings.maxPlayers).toBe(2);
    });

    it('falls back to the declared defaults when options are missing', () => {
      // A lobby created before an option existed must not produce NaN.
      const state = createInitialState('flager', host, 4, {});
      expect(state.settings.totalRounds).toBe(5);
      expect(state.settings.roundDuration).toBe(60);
    });
  });
});
