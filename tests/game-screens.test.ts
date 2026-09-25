import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GAME_IDS } from '@/games/registry';

/**
 * Every game screen is built from the same parts (docs/design-system.md →
 * Game screens). These are the parts a game drifts away from without anyone
 * noticing until the games are side by side: the result dialog, the header
 * title, the page it sits on.
 *
 * Read from the source rather than rendered, so a new game fails here the
 * moment its component exists, before anyone has played it.
 */

const COMPONENT: Record<(typeof GAME_IDS)[number], string> = {
  spyfall: 'SpyfallGame',
  minesweeper: 'MinesweeperGame',
  flager: 'FlagerGame',
  battleship: 'BattleshipGame',
  coup: 'CoupGame',
  wallrush: 'WallRushGame',
  dots: 'DotsGame',
  reversi: 'ReversiGame'
};

const source = (id: (typeof GAME_IDS)[number]) =>
  fs.readFileSync(path.join(__dirname, '..', 'src', 'components', `${COMPONENT[id]}.tsx`), 'utf8');

describe.each(GAME_IDS.map((id) => [id]))('%s', (id) => {
  const code = source(id);

  it('ends in the shared result dialog', () => {
    expect(code).toContain("from './game/ResultDialog'");
    expect(code).toMatch(/<ResultDialog[\s\S]*?gameId="/);
  });

  it('takes its header title from the registry, in the reader\'s language', () => {
    expect(code).toContain(`title={requireGame('${id}').name[lang]}`);
  });

  it('sits on the shared page, not plain white', () => {
    // Minesweeper keeps a full-height page of its own for the pan/zoom boards,
    // on the same background.
    if (id === 'minesweeper') expect(code).toContain('bg-[#F8FAFC]');
    else expect(code).toContain('GAME_PAGE');
  });

  it('never asks through the browser', () => {
    expect(code).not.toMatch(/window\.(confirm|alert|prompt)\(/);
  });

  it('shows in-match notices as the shared toast', () => {
    // Coup writes the same events into its history card.
    if (id === 'coup') return;
    expect(code).toContain('<GameNotificationToast');
  });

  it('keeps the turn or status in the shared card', () => {
    // Minesweeper shows each player's status on their own board.
    if (id === 'minesweeper') return;
    expect(code).toContain("from './game/TurnCard'");
  });
});
