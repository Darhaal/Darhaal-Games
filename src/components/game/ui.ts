/**
 * Shared pieces of every game screen, as the design system describes them
 * (docs/design-system.md → Game screens). Kept in one place so a game — old
 * or new — takes its look from here instead of copying it.
 */

/** A card in the side column, and the label that heads it. */
export const CARD = 'bg-surface rounded-2xl border border-line shadow-sm';
export const LABEL = 'text-2xs font-black uppercase tracking-widest text-muted';

/** The page every game screen sits on. */
export const GAME_PAGE = 'min-h-screen bg-page font-sans text-ink flex flex-col';

/**
 * Below this many seconds a clock is in a hurry: the header digits and the
 * turn bar both turn red. One number for every game.
 */
export const HURRY_SECONDS = 10;

/** A seat colour mixed toward white, for large coloured surfaces. */
export const softTone = (color: string) => `color-mix(in srgb, ${color} 68%, var(--surface))`;

/** Buttons, as the main menu draws them. */
export const BUTTON_PRIMARY =
  'bg-ink text-on-ink rounded-xl font-black uppercase text-xs tracking-wide hover:bg-accent transition-colors disabled:opacity-40 disabled:hover:bg-ink';
export const BUTTON_SECONDARY =
  'bg-surface text-ink border border-line rounded-xl font-bold uppercase text-xs tracking-wide hover:border-accent/30 hover:shadow-sm transition-all disabled:opacity-40';
export const BUTTON_DANGER_QUIET =
  'bg-surface text-muted border border-line rounded-xl font-bold uppercase text-2xs tracking-widest hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors';

/** Dialog overlay and panel. */
export const DIALOG_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/50 backdrop-blur-sm animate-in fade-in duration-200';
export const DIALOG_PANEL =
  'bg-surface rounded-[24px] w-full border border-line shadow-2xl p-7 animate-in zoom-in-95';
