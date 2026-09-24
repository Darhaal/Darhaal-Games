/**
 * Keyboard controls shared by the game boards.
 *
 * Every board listens on the window, because a board is not something that
 * holds focus. That makes one check essential: a key typed into the chat, the
 * Flager answer box or a dialog belongs to that field, not to the game. Before
 * this existed, typing "wasd" in the chat panned the Minesweeper board and a
 * space in the chat during Battleship setup rotated a ship instead of
 * appearing in the message.
 */

/** Anything that owns its own keys. */
const OWNS_KEYS = 'input, textarea, select, [contenteditable="true"], [role="dialog"]';

interface KeyLike {
  code: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target: unknown;
}

/**
 * Whether a key press is meant for the board.
 *
 * No when a modifier is held — Ctrl+R reloads, Cmd+= zooms the page, and a
 * game has no business with either — and no when the press lands in a text
 * field or a dialog.
 */
export function isForTheBoard(e: KeyLike): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const target = e.target as { closest?: (selector: string) => unknown } | null;
  return !target?.closest?.(OWNS_KEYS);
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * A key press as these helpers read it. `code` is the physical key, which is
 * what makes WASD work on a Russian layout, where the same keys type ЦФЫВ.
 * `key` is the character, the fallback for input that leaves `code` empty —
 * some on-screen keyboards and input methods do.
 */
interface Press {
  code: string;
  key?: string;
}

const DIRECTION_BY_CODE: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right'
};

/** The same, by character — Latin and the Russian letters on those keys. */
const DIRECTION_BY_KEY: Record<string, Direction> = {
  arrowup: 'up', w: 'up', 'ц': 'up',
  arrowdown: 'down', s: 'down', 'ы': 'down',
  arrowleft: 'left', a: 'left', 'ф': 'left',
  arrowright: 'right', d: 'right', 'в': 'right'
};

/** Arrow keys and WASD. */
export function directionOf({ code, key }: Press): Direction | null {
  return DIRECTION_BY_CODE[code] ?? DIRECTION_BY_KEY[(key ?? '').toLowerCase()] ?? null;
}

export const isSpace = ({ code, key }: Press) => code === 'Space' || key === ' ';

/** R, Q or E — by position, or by the character on either layout. */
const ROTATE_CODES = ['KeyR', 'KeyQ', 'KeyE'];
const ROTATE_KEYS = ['r', 'q', 'e', 'к', 'й', 'у'];

export const isZoomIn = ({ code, key }: Press) =>
  code === 'Equal' || code === 'NumpadAdd' || key === '+' || key === '=';
export const isZoomOut = ({ code, key }: Press) =>
  code === 'Minus' || code === 'NumpadSubtract' || key === '-' || key === '_';
export const isZoomReset = ({ code, key }: Press) =>
  code === 'Digit0' || code === 'Numpad0' || key === '0';

/** The keys that turn a piece in hand, in every game that has one. */
export const isRotate = (press: Press) =>
  isSpace(press)
  || ROTATE_CODES.includes(press.code)
  || ROTATE_KEYS.includes((press.key ?? '').toLowerCase());

export const isEscape = ({ code, key }: Press) => code === 'Escape' || key === 'Escape';
