import { describe, it, expect } from 'vitest';
import { buildProgress, winRate, type MatchRow } from '@/achievements/progress';
import { ACHIEVEMENTS, GROUPS } from '@/achievements/definitions';
import { evaluate, experience, levelOf, reachedIds, stepId, xpForLevel, XP } from '@/achievements/evaluate';
import { GAMES, type GameId } from '@/games/registry';

/**
 * The progress page's arithmetic: totals from the old baseline plus the match
 * history, streaks and records from the history, achievements and the level
 * from both.
 */

// Local noon, so no test match lands in the small hours by accident.
let clock = new Date(2026, 8, 25, 12).getTime();
const row = (game: GameId, result: 'win' | 'loss', over: Partial<MatchRow> = {}): MatchRow => ({
  game,
  result,
  mode: 'multi',
  durationSeconds: 300,
  score: null,
  details: {},
  playedAt: new Date((clock += 60_000)).toISOString(),
  ...over
});

const find = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
const status = (id: string, rows: MatchRow[], baseline = {}) =>
  evaluate(buildProgress(baseline, rows)).find((s) => s.achievement.id === id)!;

describe('buildProgress', () => {
  it('adds the baseline to the history, and reads baseline time as minutes', () => {
    const p = buildProgress(
      { dots: { wins: 2, lost: 3, time: 10 } },
      [row('dots', 'win', { durationSeconds: 90 })]
    );

    expect(p.games.dots).toMatchObject({ matches: 6, wins: 3, losses: 3, seconds: 690 });
    expect(p).toMatchObject({ matches: 6, wins: 3, losses: 3, seconds: 690, baselineMatches: 5 });
  });

  it('ignores games the baseline has that no longer exist', () => {
    const p = buildProgress({ domino: { wins: 1, lost: 4, time: 14 } }, []);

    expect(p.matches).toBe(0);
  });

  it('keeps the history newest first', () => {
    const first = row('reversi', 'win');
    const second = row('reversi', 'loss');
    const p = buildProgress(null, [first, second]);

    expect(p.history.map((r) => r.playedAt)).toEqual([second.playedAt, first.playedAt]);
    expect(p.games.reversi.lastPlayedAt).toBe(second.playedAt);
  });

  it('counts the current and the best winning streak in order', () => {
    const rows = [
      row('dots', 'win'), row('dots', 'win'), row('dots', 'win'), row('dots', 'loss'),
      row('coup', 'win'), row('reversi', 'win')
    ];
    const p = buildProgress(null, rows);

    expect(p.streak).toEqual({ current: 2, best: 3 });
  });

  it('keeps each game’s fastest win and best score from the history', () => {
    const p = buildProgress(null, [
      row('minesweeper', 'win', { durationSeconds: 240 }),
      row('minesweeper', 'loss', { durationSeconds: 30 }),
      row('minesweeper', 'win', { durationSeconds: 150 }),
      row('flager', 'win', { score: 2400 }),
      row('flager', 'loss', { score: 3100 })
    ]);

    expect(p.games.minesweeper.fastestWin).toBe(150);
    expect(p.games.flager.bestScore).toBe(3100);
  });

  it('splits solo from together', () => {
    const p = buildProgress(null, [
      row('flager', 'win', { mode: 'single' }), row('flager', 'loss', { mode: 'single' }), row('flager', 'win')
    ]);

    expect(p.games.flager.modes).toEqual({ single: { matches: 2, wins: 1 }, multi: { matches: 1, wins: 1 } });
  });

  it('counts the games played at least once', () => {
    const p = buildProgress({ coup: { wins: 0, lost: 1, time: 5 } }, [row('dots', 'loss'), row('dots', 'win')]);

    expect(p.gamesPlayed).toBe(2);
  });

  it('win rate rounds to a whole percent and is zero with no matches', () => {
    expect(winRate(2, 3)).toBe(67);
    expect(winRate(0, 0)).toBe(0);
  });
});

describe('achievements', () => {
  it('ids are unique and fit what the database accepts', () => {
    const ids = ACHIEVEMENTS.flatMap((a) => (a.kind === 'ladder' ? ['bronze', 'silver', 'gold'].map((t) => `${a.id}:${t}`) : [a.id]));

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_.:-]{1,64}$/);
  });

  it('every game has a ladder of wins and at least one feat of its own', () => {
    for (const game of GAMES) {
      const own = ACHIEVEMENTS.filter((a) => a.group === game.id);
      expect(own.some((a) => a.kind === 'ladder'), game.id).toBe(true);
      expect(own.some((a) => a.kind === 'feat'), game.id).toBe(true);
    }
    expect(GROUPS).toEqual(['general', ...GAMES.map((g) => g.id)]);
  });

  it('every achievement has both languages', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.ru && a.title.en, a.id).toBeTruthy();
      const text = a.kind === 'ladder' ? a.describe(a.steps[0]) : a.description;
      expect(text.ru && text.en, a.id).toBeTruthy();
    }
  });

  it('a ladder reports the tier reached and the next step', () => {
    const rows = Array.from({ length: 12 }, () => row('dots', 'win'));
    const s = status('wins', rows);

    expect(s).toMatchObject({ tier: 'bronze', value: 12, target: 50, complete: false });
    expect(s.reachedIds).toEqual(['wins:bronze']);
  });

  it('the baseline counts towards ladders', () => {
    const s = status('matches', [], { flager: { wins: 80, lost: 30, time: 600 } });

    expect(s).toMatchObject({ tier: 'silver', target: 500 });
  });

  it('a ladder past its last step is complete', () => {
    const s = status('explorer', GAMES.map((g) => row(g.id, 'loss')));

    expect(s).toMatchObject({ tier: 'gold', target: null, complete: true });
    expect(s.reachedIds).toEqual(['explorer:bronze', 'explorer:silver', 'explorer:gold']);
  });

  it('days in a row count calendar days, not matches', () => {
    const on = (day: number) => row('dots', 'loss', { playedAt: new Date(2026, 8, day, 20).toISOString() });

    expect(status('daily', [on(1), on(1), on(2), on(3)]).tier).toBe('bronze');
    expect(status('daily', [on(1), on(2), on(4)]).value).toBe(2);
  });

  it('versatility counts games with a win, the baseline included', () => {
    const s = status('versatile', [row('dots', 'win'), row('coup', 'loss')], { flager: { wins: 1, lost: 0, time: 1 }, spyfall: { wins: 2, lost: 0, time: 1 } });

    expect(s).toMatchObject({ value: 3, tier: 'bronze' });
  });

  it('time counts in hours', () => {
    expect(status('hours', [row('coup', 'win', { durationSeconds: 3600 })]).tier).toBe('bronze');
    expect(status('hours', [row('coup', 'win', { durationSeconds: 3599 })]).tier).toBeNull();
  });

  describe('feats', () => {
    const cases: Array<[string, MatchRow, MatchRow]> = [
      // Spyfall
      ['spyfall.disguise',
        row('spyfall', 'win', { details: { spy: true, reason: 'guessed_loc' } }),
        row('spyfall', 'win', { details: { spy: true, reason: 'time' } })],
      ['spyfall.shadow',
        row('spyfall', 'win', { details: { spy: true, reason: 'time' } }),
        row('spyfall', 'win', { details: { spy: false, reason: 'time' } })],
      ['spyfall.catcher',
        row('spyfall', 'win', { details: { caughtSpy: true } }),
        row('spyfall', 'win', { details: {} })],
      ['spyfall.witch_hunt',
        row('spyfall', 'loss', { details: { wrongAccusation: true } }),
        row('spyfall', 'loss', { details: {} })],
      // Minesweeper
      ['minesweeper.lightning',
        row('minesweeper', 'win', { durationSeconds: 170, details: { size: 20 } }),
        row('minesweeper', 'win', { durationSeconds: 170, details: { size: 10 } })],
      ['minesweeper.no_flags',
        row('minesweeper', 'win', { details: { size: 20, flags: 0 } }),
        row('minesweeper', 'win', { details: { size: 20, flags: 1 } })],
      ['minesweeper.pinpoint',
        row('minesweeper', 'win', { details: { byFlags: true } }),
        row('minesweeper', 'win', { details: { byFlags: false } })],
      ['minesweeper.minefield',
        row('minesweeper', 'win', { details: { size: 20, mines: 100 } }),
        row('minesweeper', 'win', { details: { size: 20, mines: 99 } })],
      ['minesweeper.giant',
        row('minesweeper', 'win', { details: { size: 40 } }),
        row('minesweeper', 'loss', { details: { size: 60 } })],
      ['minesweeper.race',
        row('minesweeper', 'win', { mode: 'multi' }),
        row('minesweeper', 'win', { mode: 'single' })],
      ['minesweeper.so_close',
        row('minesweeper', 'loss', { details: { safeLeft: 1 } }),
        row('minesweeper', 'loss', { details: { safeLeft: 2 } })],
      // Flager
      ['flager.first_sight',
        row('flager', 'loss', { details: { firstTry: 1 } }),
        row('flager', 'win', { details: { firstTry: 0 } })],
      ['flager.atlas',
        row('flager', 'win', { details: { rounds: 5, guessed: 5 } }),
        row('flager', 'win', { details: { rounds: 3, guessed: 3 } })],
      ['flager.photographic',
        row('flager', 'win', { details: { rounds: 5, guessed: 5, firstTry: 5 } }),
        row('flager', 'win', { details: { rounds: 5, guessed: 5, firstTry: 4 } })],
      ['flager.quick_draw',
        row('flager', 'win', { details: { fastest: 3 } }),
        row('flager', 'win', { details: { fastest: 4 } })],
      ['flager.last_chance',
        row('flager', 'loss', { details: { lastChance: 1 } }),
        row('flager', 'loss', { details: { lastChance: 0 } })],
      ['flager.high_score',
        row('flager', 'loss', { score: 4000 }),
        row('flager', 'win', { score: 3999 })],
      ['flager.top_of_class',
        row('flager', 'win', { details: { players: 4 } }),
        row('flager', 'win', { details: { players: 3 } })],
      // Battleship
      ['battleship.unsinkable',
        row('battleship', 'win', { details: { shipsLost: 0 } }),
        row('battleship', 'loss', { details: { shipsLost: 0 } })],
      ['battleship.marksman',
        row('battleship', 'win', { details: { shots: 40 } }),
        row('battleship', 'win', { details: { shots: 41 } })],
      ['battleship.by_a_thread',
        row('battleship', 'win', { details: { shipsLost: 9 } }),
        row('battleship', 'win', { details: { shipsLost: 8 } })],
      ['battleship.blitz',
        row('battleship', 'win', { durationSeconds: 299 }),
        row('battleship', 'win', { durationSeconds: 300 })],
      // Coup
      ['coup.untouchable',
        row('coup', 'win', { details: { cardsLost: 0 } }),
        row('coup', 'win', { details: { cardsLost: 1 } })],
      ['coup.last_breath',
        row('coup', 'win', { details: { cardsLost: 1 } }),
        row('coup', 'loss', { details: { cardsLost: 1 } })],
      ['coup.poker_face',
        row('coup', 'loss', { details: { bluffs: 1 } }),
        row('coup', 'win', { details: { bluffs: 0 } })],
      ['coup.master_bluffer',
        row('coup', 'win', { details: { bluffs: 3 } }),
        row('coup', 'loss', { details: { bluffs: 4 } })],
      ['coup.lie_detector',
        row('coup', 'loss', { details: { challengesWon: 2 } }),
        row('coup', 'win', { details: { challengesWon: 1 } })],
      ['coup.coup_detat',
        row('coup', 'loss', { details: { coups: 1 } }),
        row('coup', 'win', { details: { coups: 0 } })],
      // Wall Rush
      ['wallrush.light',
        row('wallrush', 'win', { details: { wallsUsed: 0 } }),
        row('wallrush', 'win', { details: { wallsUsed: 2 } })],
      ['wallrush.straight',
        row('wallrush', 'win', { details: { moves: 8, shortest: 8 } }),
        row('wallrush', 'win', { details: { moves: 9, shortest: 8 } })],
      ['wallrush.builder',
        row('wallrush', 'loss', { details: { wallsUsed: 10, wallsTotal: 10 } }),
        row('wallrush', 'win', { details: { wallsUsed: 9, wallsTotal: 10 } })],
      ['wallrush.odd_one_in',
        row('wallrush', 'win', { details: { mode: 'trio' } }),
        row('wallrush', 'loss', { details: { mode: 'trio' } })],
      ['wallrush.shoulder',
        row('wallrush', 'win', { details: { mode: 'teams' } }),
        row('wallrush', 'win', { details: { mode: 'duel' } })],
      ['wallrush.crowd',
        row('wallrush', 'win', { details: { mode: 'ffa' } }),
        row('wallrush', 'win', { details: { mode: 'teams' } })],
      // Dots & Boxes
      ['dots.landslide',
        row('dots', 'win', { score: 19, details: { boxesTotal: 25 } }),
        row('dots', 'win', { score: 18, details: { boxesTotal: 25 } })],
      ['dots.chain',
        row('dots', 'loss', { details: { bestChain: 5 } }),
        row('dots', 'win', { details: { bestChain: 4 } })],
      ['dots.big_board',
        row('dots', 'win', { details: { size: 8 } }),
        row('dots', 'win', { details: { size: 7 } })],
      ['dots.dead_heat',
        row('dots', 'win', { details: { draw: true } }),
        row('dots', 'win', { details: {} })],
      // Reversi
      ['reversi.wipeout',
        row('reversi', 'win', { score: 48 }),
        row('reversi', 'win', { score: 47 })],
      ['reversi.annihilation',
        row('reversi', 'win', { details: { opponentDiscs: 0 } }),
        row('reversi', 'win', { details: { opponentDiscs: 1 } })],
      ['reversi.corners',
        row('reversi', 'win', { details: { corners: 4 } }),
        row('reversi', 'win', { details: { corners: 3 } })],
      ['reversi.photo_finish',
        row('reversi', 'win', { details: { margin: 2 } }),
        row('reversi', 'win', { details: { margin: 3 } })],
      // General
      ['long_haul',
        row('coup', 'loss', { durationSeconds: 1800 }),
        row('coup', 'loss', { durationSeconds: 1799 })],
      ['night_owl',
        row('dots', 'loss', { playedAt: new Date(2026, 8, 25, 2, 30).toISOString() }),
        row('dots', 'loss', { playedAt: new Date(2026, 8, 25, 5, 0).toISOString() })]
    ];

    it('Spyfall’s counted feats need five rounds as the spy and ten as a local', () => {
      const spyWins = Array.from({ length: 5 }, () => row('spyfall', 'win', { details: { spy: true } }));
      const localWins = Array.from({ length: 10 }, () => row('spyfall', 'win', { details: { spy: false } }));

      expect(status('spyfall.deep_cover', spyWins).tier).toBe('gold');
      expect(status('spyfall.deep_cover', spyWins.slice(1)).tier).toBeNull();
      expect(status('spyfall.vigilant', localWins).tier).toBe('silver');
      expect(status('spyfall.vigilant', localWins.slice(1)).tier).toBeNull();
    });

    it('a marathon is ten matches on one day', () => {
      const day = (n: number, hour: number) => row('dots', 'loss', { playedAt: new Date(2026, 8, 25 + n, hour).toISOString() });
      const ten = Array.from({ length: 10 }, (_, i) => day(0, 8 + i));

      expect(status('marathon', ten).tier).toBe('silver');
      expect(status('marathon', [...ten.slice(1), day(1, 9)]).tier).toBeNull();
    });

    it('a comeback is a win straight after five losses', () => {
      const losses = Array.from({ length: 5 }, () => row('coup', 'loss'));

      expect(status('comeback', [...losses, row('coup', 'win')]).tier).toBe('silver');
      expect(status('comeback', [...losses.slice(1), row('coup', 'win')]).tier).toBeNull();
    });

    it.each(cases)('%s is reached by the right match and not by a near miss', (id, hit, miss) => {
      expect(status(id, [hit]).tier).toBe((find(id) as { tier: string }).tier);
      expect(status(id, [miss]).tier).toBeNull();
    });

    it('every feat has a case above', () => {
      const covered = new Set([
        ...cases.map(([id]) => id),
        // Counted over several matches, tested on their own above.
        'spyfall.deep_cover', 'spyfall.vigilant', 'marathon', 'comeback'
      ]);
      for (const a of ACHIEVEMENTS) if (a.kind === 'feat') expect(covered, a.id).toContain(a.id);
    });
  });

  it('stepId names a ladder’s step by tier and a feat by itself', () => {
    expect(stepId(find('wins'), 'gold')).toBe('wins:gold');
    expect(stepId(find('coup.untouchable'), 'gold')).toBe('coup.untouchable');
  });

  it('reachedIds lists every step reached', () => {
    const ids = reachedIds(evaluate(buildProgress(null, [row('reversi', 'win', { score: 50 })])));

    expect(ids).toEqual(expect.arrayContaining(['reversi.wins:bronze', 'reversi.wipeout']));
  });
});

describe('level', () => {
  it('the curve: 0, 100, 300, 600, 1000', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('places experience inside its level', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, span: 100 });
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100)).toEqual({ level: 2, into: 0, span: 200 });
    expect(levelOf(450)).toEqual({ level: 3, into: 150, span: 300 });
  });

  it('a match, a win, the minutes and the achievements each count', () => {
    const rows = [row('coup', 'win', { durationSeconds: 600 })];
    const p = buildProgress(null, rows);
    const statuses = evaluate(p);
    // coup.wins:bronze is the only step a single win reaches here.
    expect(reachedIds(statuses)).toEqual(['coup.wins:bronze']);

    expect(experience(p, statuses)).toBe(XP.match + XP.win + 10 * XP.minute + XP.tier.bronze);
  });

  it('a long match is capped, so it is not worth ten short ones', () => {
    const p = buildProgress(null, [row('spyfall', 'loss', { durationSeconds: 5 * 3600 })]);

    expect(experience(p, [])).toBe(XP.match + XP.minutesPerMatchCap * XP.minute);
  });

  it('the baseline earns experience by the same rules', () => {
    const p = buildProgress({ dots: { wins: 1, lost: 1, time: 500 } }, []);

    // Two matches, one win, and the 500 minutes capped at 30 per match.
    expect(experience(p, [])).toBe(2 * XP.match + XP.win + 60 * XP.minute);
  });
});
