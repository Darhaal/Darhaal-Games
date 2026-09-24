# Design system

How Darhaal Games looks, written down from the screens that set the tone: the
main menu (`src/components/HomeClient.tsx`), room creation
(`src/app/create/page.tsx`) and the room list (`src/app/play/page.tsx`).
Every recipe below is lifted from those files — when in doubt, open them and
copy, do not invent.

The feel in one line: **a light, calm page of white cards with hairline warm
borders, dark ink, and one red accent that appears on hover and focus.**

---

## Tokens

### Colour

| Role | Value | Where it shows |
|------|-------|----------------|
| Page background | `#F8FAFC` | every screen's root (`bg-[#F8FAFC]`) |
| Surface | `white` | cards, panels, inputs on focus |
| Hairline border | `#E6E1DC` | every card, button and panel edge |
| Divider inside a card | `#F1F5F9` | `border-t border-[#F1F5F9]`, `h-px bg-[#F1F5F9]` |
| Ink | `#1A1F26` | headings, body text, primary buttons, selected state |
| Muted text | `#8A9099` | labels, captions, icons at rest |
| Placeholder / faint icon | `gray-400` (`#9ca3af`) | placeholders, search icons |
| Accent | `#9e1316` | primary button hover, hover/focus borders at `/20`–`/30`, loaders, the "Games" in the logo |
| Soft fill | `#F8FAFC` | inputs, icon wells, info chips |
| Selected fill | `#F1F5F9` | selected sort chip, selected filter row |
| Warm hover fill | `#F4F3F0` / `#F5F5F0` | hover on neutral rows |
| Success / online | `emerald-500` / `emerald-600` | online dot, free seats count |
| Danger | `red-50` / `red-200` / `red-500` | destructive hover, errors |
| Host | `amber-500` | the crown |

The main menu gives each secondary tile its own hue — **blue** (create),
**amber** (achievements), **emerald** (settings) — used only as a tinted corner
and an icon that fills on hover. Keep that to menu tiles.

Seat colours for pieces on a board live in `src/games/palette.ts`; never pick
new ones in a component.

Prefer `#1A1F26` to Tailwind's `gray-900` for ink — the older screens mix
them; new work uses the hex.

### Radius

| Size | Class | Used for |
|------|-------|----------|
| Chip, small button | `rounded-lg` / `rounded-md` | sort chips, compact buttons, info chips |
| Control | `rounded-xl` | inputs, buttons, list rows, icon buttons |
| Card / panel | `rounded-2xl` | sidebar cards, lobby rows, board-side panels |
| Feature card | `rounded-[24px]`–`rounded-[32px]` | menu tiles, game picker cards |
| Form / hero | `rounded-[40px]` | the create form |
| Modal | `rounded-[24px]` / `rounded-3xl` | dialog panels |
| Pill | `rounded-full` | avatars, profile pill, status dots |

**Game boards are the exception: they are square.** Cells, grid and outer edge
have no rounding (see [Game boards](#game-boards)).

### Shadow

- Resting card: `shadow-sm`.
- Hover lift: `hover:shadow-lg` or `hover:shadow-xl`, tinted —
  `hover:shadow-[#1A1F26]/5`, or the tile's hue, e.g. `hover:shadow-blue-500/5`.
- Large form or modal: `shadow-2xl shadow-[#1A1F26]/5`.
- Never a hard black shadow.

### Type

- Family: the app's sans (`font-sans`, Geist).
- Screen title: `text-lg md:text-xl font-bold text-[#1A1F26] tracking-tight leading-none`,
  with a subtitle `text-xs text-[#8A9099] font-medium`.
- Card title: `text-xl`–`text-2xl font-black text-[#1A1F26]`.
- Hero: `text-4xl md:text-7xl font-black tracking-tighter leading-none`.
- **Label** (the most recognisable piece of the style):
  `text-2xs font-black text-[#8A9099] uppercase tracking-widest` — often with a
  `w-3.5 h-3.5` icon before it.
- Body: `text-sm font-medium` (or `font-bold` for values).
- Numbers that change: `tabular-nums`.
- `text-3xs` / `text-2xs` are project tokens (`src/app/globals.css`) that grow
  on wide screens — use them rather than `text-[10px]`.

### Motion

- Enter: `animate-in fade-in` plus `slide-in-from-bottom-*` or `zoom-in-95`,
  `duration-300`–`500`.
- Hover: `hover:-translate-y-1` or `hover:scale-[1.01]`–`[1.02]` on cards;
  colour transitions with `transition-all` / `transition-colors`.
- Press: `active:scale-95` (small) / `active:scale-[0.98]` (wide).

---

## Components

Copy these; adjust padding, not character.

**Card**
```
bg-white p-4 md:p-5 rounded-2xl border border-[#E6E1DC] shadow-sm
```
with a header label
```
flex items-center gap-2 text-xs font-bold text-[#8A9099] uppercase tracking-wide mb-3
```

**Interactive card / list row**
```
group bg-white border border-[#E6E1DC] p-4 rounded-2xl
hover:shadow-lg hover:border-[#9e1316]/20 transition-all duration-300
```

**Primary button** — dark, turns red on hover
```
bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-wide
hover:bg-[#9e1316] hover:shadow-lg transition-all active:scale-[0.98]
disabled:opacity-50
```
Full width in forms (`w-full py-4`); compact elsewhere
(`px-4 py-2 rounded-lg font-bold text-xs`).

**Secondary / icon button** — white, the border warms on hover
```
group p-2.5 bg-white border border-[#E6E1DC] rounded-xl
hover:border-[#9e1316]/30 hover:shadow-sm transition-all
```
icon: `text-[#8A9099] group-hover:text-[#9e1316]`.

**Destructive button** — neutral until hovered
```
bg-white border border-[#E6E1DC] text-[#8A9099] rounded-xl shadow-sm
hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors
```

**Input**
```
w-full bg-[#F8FAFC] border border-gray-200 focus:bg-white focus:border-[#1A1F26]
rounded-xl py-3 px-4 font-bold text-[#1A1F26] outline-none transition-all
placeholder:text-gray-400 text-sm
```
A search field is a card that holds a bare input:
`bg-white p-3 rounded-2xl border border-[#E6E1DC] shadow-sm focus-within:border-[#9e1316]/30`.

**Segmented choice / sort chip**
```
py-2 px-3 rounded-lg text-xs font-bold transition-all
selected:  bg-[#F1F5F9] text-[#1A1F26]
otherwise: text-gray-500 hover:bg-gray-50
```

**Toggle row** — as the "private room" switch in `create/page.tsx`: a
`bg-[#F8FAFC] rounded-xl p-3` row, an icon well that goes dark when on, and a
`w-10 h-6 rounded-full` track (`bg-[#1A1F26]` on, `bg-gray-200` off).

**Badge / chip**
- Value badge: `text-xs font-bold text-white bg-[#1A1F26] px-2 py-0.5 rounded tabular-nums`
- Info chip: `bg-[#F8FAFC] px-2 py-1 rounded-md text-xs font-medium`

**Icon well**
```
w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E6E1DC] text-[#1A1F26]
flex items-center justify-center
```
On a hoverable card it inverts: `group-hover:bg-[#1A1F26] group-hover:text-white`.

**Empty state**
```
flex flex-col items-center justify-center py-20
border-2 border-dashed border-[#E6E1DC] rounded-3xl bg-white/50
```
with a round `bg-[#F1F5F9]` icon, a bold line, a muted line, and a compact
primary button.

**Sticky page header**
```
sticky top-0 z-30 w-full bg-[#F8FAFC]/90 backdrop-blur-xl
border-b border-[#E6E1DC] shadow-sm
```
back button on the left (secondary icon button), title + subtitle, actions on
the right.

**Modal** — always the app's own, never `window.confirm`/`alert`
```
overlay: fixed inset-0 z-[60] flex items-center justify-center p-4
         bg-[#1A1F26]/50 (up to /60) backdrop-blur-sm animate-in fade-in
panel:   bg-white p-6 rounded-[24px] w-full max-w-sm shadow-2xl
         border border-[#E6E1DC] animate-in zoom-in-95
```
The overlay carries `role="dialog" aria-modal="true"` and an `aria-label`,
closes on Escape (`useEscape`) and on a click outside the panel.

**Loading** — `Loader2` with `animate-spin text-[#9e1316]`, centred on
`bg-[#F8FAFC]`.

**Page atmosphere** (menus and lists only, not game boards): a
`bg-[url('/noise.svg')] opacity-30–40 mix-blend-overlay` layer and one or two
blurred blobs such as `bg-[#9e1316]/5 rounded-full blur-[100px]`.

---

## Game boards

Game screens use the same page and panels, but the board itself is strict:

- **Square.** No rounded cells, no rounded outer edge.
- **White cells on a grey grid** (`#E6E1DC`), the outer edge as wide as the
  gaps inside.
- **Pieces in seat colours** from `src/games/palette.ts`. Large coloured
  surfaces — walls, finish lines — wear them softened
  (`color-mix(in srgb, <seat> 68%, white)`), so the board stays calm; a grey
  "no owner" piece keeps full tone so it does not vanish into the grid.
- **Panels around the board** — legend, tray, player list, action buttons —
  are ordinary cards from the section above, on the `#F8FAFC` page.

---

## Behaviour that is part of the look

- Every string exists in Russian and English, kept in a local `T` / `UI_TEXT`
  object next to the component. Code and comments are English.
- Icon-only buttons have an `aria-label`.
- Keyboard shortcuts go through `useGameKeys` and are written in the game's
  rules (see `docs/games.md`).
- Phones first: check 375 px wide — nothing may sit under the floating chat
  button, and wide rows stack.
