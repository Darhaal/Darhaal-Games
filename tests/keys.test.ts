import { describe, it, expect } from 'vitest';
import {
  directionOf, isEscape, isForTheBoard, isRotate, isSpace, isZoomIn, isZoomOut, isZoomReset
} from '@/lib/keys';
import { moveInDirection } from '@/lib/gameLogic/wallrush';

/**
 * Keyboard controls for the boards.
 *
 * Two kinds of failure are guarded here. The quiet one: a key the rules
 * promise that does nothing (Space in Minesweeper did nothing at all). The
 * loud one: a board key firing while the player is typing — "wasd" in the
 * chat panning the board, a space in a message rotating a ship.
 */

/** A stand-in for an event target: answers `closest` for the selectors it is inside. */
const inside = (...matches: string[]) => ({
  closest: (selector: string) =>
    selector.split(',').some((s) => matches.includes(s.trim())) ? {} : null
});

const press = (code: string, extra: Record<string, unknown> = {}) =>
  ({ code, key: '', target: inside(), ...extra });

describe('which presses belong to the board', () => {
  it('takes a plain key pressed on the page', () => {
    expect(isForTheBoard(press('KeyW'))).toBe(true);
    expect(isForTheBoard({ code: 'Space', target: null })).toBe(true);
  });

  it('leaves text fields alone — the chat, the Flager answer box', () => {
    expect(isForTheBoard(press('KeyW', { target: inside('input') }))).toBe(false);
    expect(isForTheBoard(press('Space', { target: inside('textarea') }))).toBe(false);
  });

  it('leaves dialogs alone', () => {
    expect(isForTheBoard(press('Space', { target: inside('[role="dialog"]') }))).toBe(false);
  });

  it('never takes a shortcut with a modifier — Ctrl+R still reloads', () => {
    expect(isForTheBoard(press('KeyR', { ctrlKey: true }))).toBe(false);
    expect(isForTheBoard(press('Equal', { metaKey: true }))).toBe(false);
    expect(isForTheBoard(press('KeyW', { altKey: true }))).toBe(false);
  });
});

describe('reading keys', () => {
  it('maps arrows and WASD by position', () => {
    expect(directionOf({ code: 'ArrowUp' })).toBe('up');
    expect(directionOf({ code: 'KeyW' })).toBe('up');
    expect(directionOf({ code: 'KeyA' })).toBe('left');
    expect(directionOf({ code: 'ArrowRight' })).toBe('right');
    expect(directionOf({ code: 'KeyS' })).toBe('down');
  });

  it('works on a Russian layout, and when only the character is known', () => {
    // Same physical key, Cyrillic character.
    expect(directionOf({ code: 'KeyW', key: 'ц' })).toBe('up');
    // Some input methods leave `code` empty.
    expect(directionOf({ code: '', key: 'ц' })).toBe('up');
    expect(directionOf({ code: '', key: 'ArrowDown' })).toBe('down');
  });

  it('ignores everything else', () => {
    expect(directionOf({ code: 'KeyQ', key: 'q' })).toBeNull();
  });

  it('reads Space, Escape and the zoom keys either way', () => {
    expect(isSpace({ code: 'Space' })).toBe(true);
    expect(isSpace({ code: '', key: ' ' })).toBe(true);
    expect(isEscape({ code: '', key: 'Escape' })).toBe(true);

    expect(isZoomIn({ code: 'NumpadAdd' })).toBe(true);
    expect(isZoomIn({ code: '', key: '+' })).toBe(true);
    expect(isZoomOut({ code: 'Minus' })).toBe(true);
    expect(isZoomReset({ code: 'Digit0' })).toBe(true);
  });

  it('turns a piece with R, Q, E or Space, on either layout', () => {
    for (const code of ['KeyR', 'KeyQ', 'KeyE', 'Space']) expect(isRotate({ code })).toBe(true);
    expect(isRotate({ code: '', key: 'к' })).toBe(true);
    expect(isRotate({ code: 'KeyT', key: 't' })).toBe(false);
  });
});

describe('arrow keys in Wall Rush', () => {
  const from = { x: 4, y: 4 };

  it('steps one square the way the key points', () => {
    const moves = [{ x: 4, y: 3 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 3, y: 4 }];
    expect(moveInDirection(from, moves, 'up')).toEqual({ x: 4, y: 3 });
    expect(moveInDirection(from, moves, 'left')).toEqual({ x: 3, y: 4 });
  });

  it('jumps a pawn in the way with the same key', () => {
    // A pawn at (4, 3): the legal move up is the jump to (4, 2).
    expect(moveInDirection(from, [{ x: 4, y: 2 }], 'up')).toEqual({ x: 4, y: 2 });
  });

  it('does nothing where there is no straight move — a wall, or only a side-step', () => {
    // The jump is blocked, so the only moves round the pawn are diagonal.
    const sideSteps = [{ x: 3, y: 3 }, { x: 5, y: 3 }];
    expect(moveInDirection(from, sideSteps, 'up')).toBeNull();
    expect(moveInDirection(from, [], 'down')).toBeNull();
  });
});
