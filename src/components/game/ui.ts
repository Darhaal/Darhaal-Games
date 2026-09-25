/**
 * Shared pieces of every game screen, as the design system describes them
 * (docs/design-system.md → Game screens). Kept in one place so a game — old
 * or new — takes its look from here instead of copying it.
 */

/** A card in the side column, and the label that heads it. */
export const CARD = 'bg-white rounded-2xl border border-[#E6E1DC] shadow-sm';
export const LABEL = 'text-2xs font-black uppercase tracking-widest text-[#8A9099]';

/** The page every game screen sits on. */
export const GAME_PAGE = 'min-h-screen bg-[#F8FAFC] font-sans text-[#1A1F26] flex flex-col';

/**
 * Below this many seconds a clock is in a hurry: the header digits and the
 * turn bar both turn red. One number for every game.
 */
export const HURRY_SECONDS = 10;

/** A seat colour mixed toward white, for large coloured surfaces. */
export const softTone = (color: string) => `color-mix(in srgb, ${color} 68%, white)`;

/** Buttons, as the main menu draws them. */
export const BUTTON_PRIMARY =
  'bg-[#1A1F26] text-white rounded-xl font-black uppercase text-xs tracking-wide hover:bg-[#9e1316] transition-colors disabled:opacity-40 disabled:hover:bg-[#1A1F26]';
export const BUTTON_SECONDARY =
  'bg-white text-[#1A1F26] border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs tracking-wide hover:border-[#9e1316]/30 hover:shadow-sm transition-all disabled:opacity-40';
export const BUTTON_DANGER_QUIET =
  'bg-white text-[#8A9099] border border-[#E6E1DC] rounded-xl font-bold uppercase text-2xs tracking-widest hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors';

/** Dialog overlay and panel. */
export const DIALOG_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1F26]/50 backdrop-blur-sm animate-in fade-in duration-200';
export const DIALOG_PANEL =
  'bg-white rounded-[24px] w-full border border-[#E6E1DC] shadow-2xl p-7 animate-in zoom-in-95';
