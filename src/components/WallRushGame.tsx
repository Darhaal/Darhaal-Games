'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { BrickWall, Crown, Eye, Flag, Trophy } from 'lucide-react';
import type { Cell, Wall, WallOrientation, WallRushPlayer, WallRushState } from '@/types/wallrush';
import {
  GOAL_FOR_MODE, canPlaceWall, centreCell, legalMoves, moveInDirection, sameCell, seatsForMode, teamOf
} from '@/lib/gameLogic/wallrush';
import { useGameKeys } from '@/hooks/useGameKeys';
import { directionOf, isEscape, isRotate } from '@/lib/keys';
import { wallKey, wallReaches, type WallReach } from '@/lib/gameLogic/wallrushJoints';
import PlayerToken from './PlayerToken';
import { useEscape } from '@/hooks/useEscape';
import { SEAT_COLORS, TEAM_COLORS, UNOWNED } from '@/games/palette';
import GameHeader from './GameHeader';
import RematchButton from './RematchButton';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { playSfx } from '@/lib/sound';

interface WallRushGameProps {
  gameState: WallRushState;
  userId: string;
  movePawn: (cell: Cell) => void;
  placeWall: (wall: Wall) => void;
  resign: () => void;
  handleTimeout: () => void;
  leaveGame: () => void;
  lang: 'ru' | 'en';
}

const UI_TEXT = {
  ru: {
    turnLabel: 'Ход',
    wallsLabel: 'Ваши стены',
    playersLabel: 'Игроки',
    yourTurn: 'Ваш ход',
    moveHint: 'Шагните на подсвеченную клетку или поставьте стену',
    thinking: 'обдумывает ход',
    dragHowTo: 'Перетащите стену на доску. R или пробел — повернуть',
    dropHint: 'Отпустите над промежутком между клетками',
    wallsOnYourTurn: 'Стены ставятся в свой ход',
    noWalls: 'Стены кончились',
    you: 'вы',
    youWin: 'Победа',
    teamWins: 'Победила пара',
    winner: 'Победитель',
    matchOver: 'Партия окончена',
    viewBoard: 'Посмотреть доску',
    showResult: 'Итоги',
    toMenu: 'В меню',
    teamA: 'Пара A',
    teamB: 'Пара B',
    resign: 'Сдаться',
    resigned: 'сдался',
    watching: 'Вы сдались — досматриваете партию',
    resignTitle: 'Сдаться?',
    resignDesc: 'Ваша пешка уйдёт с доски. Вы останетесь в комнате и сможете досмотреть партию.',
    resignDescDuel: 'Соперник сразу победит. Вы останетесь в комнате.',
    cancel: 'Отмена'
  },
  en: {
    turnLabel: 'Turn',
    wallsLabel: 'Your walls',
    playersLabel: 'Players',
    yourTurn: 'Your turn',
    moveHint: 'Step to a highlighted square or place a wall',
    thinking: 'is thinking',
    dragHowTo: 'Drag a wall onto the board. R or Space turns it',
    dropHint: 'Release over a gap between squares',
    wallsOnYourTurn: 'Walls go down on your turn',
    noWalls: 'Out of walls',
    you: 'you',
    youWin: 'You win',
    teamWins: 'Team wins',
    winner: 'Winner',
    matchOver: 'Match over',
    viewBoard: 'View the board',
    showResult: 'Results',
    toMenu: 'Main menu',
    teamA: 'Team A',
    teamB: 'Team B',
    resign: 'Resign',
    resigned: 'resigned',
    watching: 'You resigned — watching the rest of the match',
    resignTitle: 'Resign?',
    resignDesc: 'Your pawn leaves the board. You stay in the room and can watch the match out.',
    resignDescDuel: 'Your rival wins at once. You stay in the room.',
    cancel: 'Cancel'
  }
};

/** The design system's card and label (docs/design-system.md). */
const CARD = 'bg-white rounded-2xl border border-[#E6E1DC] shadow-sm';
const LABEL = 'text-2xs font-black uppercase tracking-widest text-[#8A9099]';

/** Walls take the colour of whoever placed them; pieces their seat colour. */
const colorFor = (state: WallRushState, seat: number) =>
  (state.settings.mode === 'teams' ? TEAM_COLORS : SEAT_COLORS)[seat % 4];

/** Width of a groove as a fraction of a cell. */
const GUTTER_FR = 0.34;

/**
 * One groove as a percentage of a wall's own length (cell + groove + cell),
 * which is what an absolutely placed bar's offsets are measured against.
 */
const GROOVE_OF_WALL_PCT = (GUTTER_FR / (2 + GUTTER_FR)) * 100;

/**
 * White squares on a grey grid — the grey is the site's own border colour,
 * so the board belongs to the same page as the lobby around it.
 */
const GRID_BG = '#E6E1DC';
const CELL_BG = '#FFFFFF';

/** A seat colour mixed toward white: how walls and finish lines wear it. */
const softTone = (color: string) => `color-mix(in srgb, ${color} 68%, white)`;

/**
 * A wall: a plain bar in its owner's colour, filling whatever box it is given.
 *
 * On the board that box is the whole gap, so the wall sits flush against the
 * squares on either side instead of floating in the middle of it.
 *
 * Soft by colour, not by shape: the seat colour is mixed toward white, so a
 * wall reads as its owner's without shouting, and the ends stay square so
 * walls in line still meet.
 */
function WallBar({
  color, style, className = ''
}: { color: string; style?: React.CSSProperties; className?: string }) {
  // A wall with no owner left at the table is already grey; softened too, it
  // would vanish into the grey grid, so it keeps its full tone.
  const tone = color === UNOWNED ? color : softTone(color);

  return <span className={`block ${className}`} style={{ backgroundColor: tone, ...style }} />;
}

/**
 * A wall waiting in the tray: the same soft bar as on the board, with its
 * corners eased a little — here it is a piece in the hand, not a section of a
 * barrier that has to meet the next one. Grey while it is not yours to place.
 */
function TrayWall({ o, color, lit }: { o: WallOrientation; color: string; lit: boolean }) {
  return (
    <span
      className={`block rounded-[3px] ${o === 'h' ? 'w-16 h-3.5' : 'w-3.5 h-12'}`}
      style={{ backgroundColor: lit ? softTone(color) : '#DAD7D1' }}
    />
  );
}

/**
 * Where a wall's bar sits inside the three tracks it spans: the full width of
 * the groove, and along its length reaching into the intersections at its
 * ends by however much `wallReaches` decided.
 */
const barPlacement = (o: WallOrientation, reach: WallReach): React.CSSProperties =>
  o === 'h'
    ? { position: 'absolute', top: 0, bottom: 0,
        left: `${-reach.start * GROOVE_OF_WALL_PCT}%`, right: `${-reach.end * GROOVE_OF_WALL_PCT}%` }
    : { position: 'absolute', left: 0, right: 0,
        top: `${-reach.start * GROOVE_OF_WALL_PCT}%`, bottom: `${-reach.end * GROOVE_OF_WALL_PCT}%` };

export default function WallRushGame({
  gameState, userId, movePawn, placeWall, resign, handleTimeout, leaveGame, lang
}: WallRushGameProps) {
  const t = UI_TEXT[lang];
  const [showRules, setShowRules] = useState(false);
  // Resigning cannot be undone, so it is confirmed first.
  const [pendingResign, setPendingResign] = useState(false);
  // The result can be put aside to look at the final position, and brought back.
  const [resultHidden, setResultHidden] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gameState.settings.turnDuration);

  /**
   * The wall being dragged out of the tray, and where it would land.
   *
   * Moving is always available by tapping a square — there is no mode to
   * switch into or out of. A wall is a piece you pick up from below the board
   * and drop where you want it, which is how the game works on a table and the
   * only interaction that gives a phone something big enough to grab.
   */
  const [dragging, setDragging] = useState<WallOrientation | null>(null);
  const [slot, setSlot] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const size = gameState.size || 9;
  const sides = seatsForMode(gameState.settings.mode);
  const goal = GOAL_FOR_MODE[gameState.settings.mode];
  const racingToCentre = goal === 'centre';
  const me = gameState.players.find((p) => p.id === userId);
  const isMyTurn = gameState.status === 'playing' && gameState.turnPlayerId === userId;
  // Seated, match running, pawn gone: a spectator of their own room.
  const iResigned = gameState.status === 'playing' && !!me && !gameState.pawns[userId];
  const canResign = gameState.status === 'playing' && !!me && !!gameState.pawns[userId];
  const stillRacing = gameState.players.filter((p) => gameState.pawns[p.id]).length;
  const resignedIds = new Set(gameState.resigned ?? []);
  const turnPlayer = gameState.players.find((p) => p.id === gameState.turnPlayerId);
  const isFinished = gameState.status === 'finished';
  const myColor = me ? colorFor(gameState, me.seat) : SEAT_COLORS[0];
  const canBuild = isMyTurn && !!me && me.wallsLeft > 0;

  /**
   * The turn clock. Any client may pass an expired turn on — the deadline is
   * the authority, so a player who closed their tab cannot stall the match.
   */
  useEffect(() => {
    if (gameState.status !== 'playing' || !gameState.turnDeadline) return;
    const deadline = gameState.turnDeadline;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && (isMyTurn || Date.now() - deadline > 5000)) {
        handleTimeout();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, gameState.turnDeadline, isMyTurn, handleTimeout]);

  useEffect(() => {
    if (isFinished && gameState.winnerIds.length > 0) {
      playSfx(gameState.winnerIds.includes(userId) ? 'win' : 'lose');
    }
  }, [isFinished, gameState.winnerIds, userId]);

  const myMoves = useMemo(() => {
    if (!isMyTurn || !gameState.pawns[userId]) return [];
    const others = gameState.players
      .filter((p) => p.id !== userId && gameState.pawns[p.id])
      .map((p) => gameState.pawns[p.id]);
    return legalMoves(gameState.walls, gameState.pawns[userId], others, size, racingToCentre);
  }, [isMyTurn, gameState.pawns, gameState.players, gameState.walls, size, userId, racingToCentre]);

  /**
   * Whether the piece in hand may land where it currently sits.
   *
   * Only the square under the pointer is tested. Marking up every legal slot
   * turned the board into a rash of bars and told the player nothing they
   * needed before choosing — the answer they want is about the one place they
   * are pointing at.
   */
  const canDropHere = useMemo(() => {
    if (!dragging || !slot || !canBuild) return false;

    const pawns = gameState.players
      .filter((p) => gameState.pawns[p.id])
      .map((p) => ({ cell: gameState.pawns[p.id], side: sides[p.seat] }));

    return canPlaceWall(gameState.walls, { ...slot, o: dragging }, pawns, size, goal);
  }, [dragging, slot, canBuild, gameState.players, gameState.pawns, gameState.walls, sides, size, goal]);

  // Board geometry in track units, so a pointer position can be turned into an
  // intersection without knowing the rendered pixel size.
  const units = size + (size - 1) * GUTTER_FR;

  /** Nearest intersection to a pointer position, or null when off the board. */
  const slotAt = useCallback((clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    // Inverts slotCentre: u = (i + 1) + i*G + G/2
    const toIndex = (offset: number, span: number) =>
      Math.round(((offset / span) * units - 1 - GUTTER_FR / 2) / (1 + GUTTER_FR));

    const x = toIndex(clientX - rect.left, rect.width);
    const y = toIndex(clientY - rect.top, rect.height);

    if (x < 0 || y < 0 || x > size - 2 || y > size - 2) return null;
    return { x, y };
  }, [size, units]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setSlot(slotAt(e.clientX, e.clientY));
  }, [dragging, slotAt]);

  const onDragEnd = useCallback(() => {
    if (dragging && slot && canDropHere) {
      placeWall({ x: slot.x, y: slot.y, o: dragging });
    }
    setDragging(null);
    setSlot(null);
  }, [dragging, slot, canDropHere, placeWall]);

  /**
   * Keyboard, as the rules describe it:
   *   arrows / WASD   step your pawn that way (jumping a pawn in the way)
   *   R, Q, E, Space  turn the wall in hand while dragging it
   *   Esc             put the wall back without placing it
   */
  useGameKeys(gameState.status === 'playing' && !!me, (e) => {
    if (dragging) {
      if (isEscape(e)) { setDragging(null); setSlot(null); return true; }
      if (isRotate(e)) { setDragging((o) => (o === 'h' ? 'v' : 'h')); return true; }
      return;
    }

    const dir = directionOf(e);
    if (!dir || !isMyTurn || !gameState.pawns[userId]) return;
    const target = moveInDirection(gameState.pawns[userId], myMoves, dir);
    if (target && !e.repeat) movePawn(target);
    return true;
  });

  const pawnAt = (cell: Cell): WallRushPlayer | undefined =>
    gameState.players.find((p) => gameState.pawns[p.id] && sameCell(gameState.pawns[p.id], cell));

  /** Which edge of the board a player starting on `side` is racing to. */
  const goalEdge = (side: string): 'bottom' | 'top' | 'right' | 'left' =>
    side === 'north' ? 'bottom' : side === 'south' ? 'top' : side === 'west' ? 'right' : 'left';

  /**
   * The outer grey line, as a percentage of the board's width — one groove
   * wide, so the edge of the board is the same line as every gap inside it.
   * Padding percentages are measured against width on every side, and the
   * board is square, so one number serves all four.
   */
  const edgePct = (GUTTER_FR / (units + 2 * GUTTER_FR)) * 100;

  /** The outer line along the edge a player is racing to, in their colour. */
  const finishLine = (p: WallRushPlayer) => {
    const edge = goalEdge(sides[p.seat]);
    const across = edge === 'top' || edge === 'bottom';
    return (
      <span
        key={`goal${p.id}`}
        aria-hidden
        className="absolute"
        style={{
          backgroundColor: softTone(colorFor(gameState, p.seat)),
          [edge]: 0,
          ...(across
            ? { left: `${edgePct}%`, right: `${edgePct}%`, height: `${edgePct}%` }
            : { top: `${edgePct}%`, bottom: `${edgePct}%`, width: `${edgePct}%` })
        }}
      />
    );
  };

  const wallColor = (w: Wall) => {
    const owner = w.by ? gameState.players.find((p) => p.id === w.by) : undefined;
    return owner ? colorFor(gameState, owner.seat) : UNOWNED;
  };

  const centre = centreCell(size);
  const track = `repeat(${size - 1}, minmax(0, 1fr) minmax(0, ${GUTTER_FR}fr)) minmax(0, 1fr)`;
  const board: React.ReactNode[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = { x, y };
      const occupant = pawnAt(cell);
      // Moving never goes away — there is no mode to leave it for. It only
      // steps aside while a piece is actually in hand.
      const isTarget = !dragging && myMoves.some((m) => sameCell(m, cell));
      const isCentre = racingToCentre && sameCell(cell, centre);

      board.push(
        <button
          key={`c${x},${y}`}
          type="button"
          disabled={!isTarget}
          onClick={() => isTarget && movePawn(cell)}
          style={{
            gridColumn: 2 * x + 1,
            gridRow: 2 * y + 1,
            // Square: a wall is square-ended and fills the gap, so any
            // rounding here shows as a notch of grey between the two.
            backgroundColor: isCentre
              ? '#FEF3C7'
              : isTarget
                ? `color-mix(in srgb, ${myColor} 14%, ${CELL_BG})`
                : CELL_BG,
            ...(isCentre ? { boxShadow: 'inset 0 0 0 2px #FBBF24' } : {})
          }}
          className={`relative aspect-square transition-[filter] ${
            isTarget ? 'cursor-pointer hover:brightness-95' : ''
          }`}
          aria-label={`${x + 1},${y + 1}`}
        >
          {isCentre && !occupant && (
            <span className="absolute inset-0 m-auto w-1/3 h-1/3 rounded-full border-2 border-amber-400" />
          )}

          {occupant && (
            <PlayerToken
              className="absolute inset-[15%]"
              color={colorFor(gameState, occupant.seat)}
              seat={occupant.seat}
              mine={occupant.id === userId}
            />
          )}

          {isTarget && !occupant && (
            <span
              className="absolute inset-0 m-auto w-[30%] h-[30%] rounded-full opacity-70"
              style={{ backgroundColor: myColor }}
            />
          )}
        </button>
      );
    }
  }

  /**
   * The piece under the pointer, drawn with the same grid placement a real
   * wall gets — spanning three tracks rather than one groove, so what you see
   * while dragging is the size of what you are about to place. It joins the
   * walls around it the way it will once dropped.
   */
  const preview: Wall | null = dragging && slot && canDropHere ? { ...slot, o: dragging } : null;
  const reaches = wallReaches(preview ? [...gameState.walls, preview] : gameState.walls, size);

  const wallAt = (w: Wall, color: string, key: string, faded = false) => (
    <span
      key={key}
      aria-hidden
      style={
        w.o === 'h'
          ? { gridColumn: `${2 * w.x + 1} / span 3`, gridRow: 2 * w.y + 2 }
          : { gridColumn: 2 * w.x + 2, gridRow: `${2 * w.y + 1} / span 3` }
      }
      className={`relative pointer-events-none ${faded ? 'opacity-60' : ''}`}
    >
      <WallBar
        color={color}
        style={barPlacement(w.o, reaches.get(wallKey(w)) ?? { start: 0, end: 0 })}
      />
    </span>
  );

  // Walls already on the board, in the colour of whoever built them.
  for (const w of gameState.walls) board.push(wallAt(w, wallColor(w), `w${wallKey(w)}`));
  if (preview) board.push(wallAt(preview, myColor, 'preview', true));

  const orderedPlayers = [...gameState.players].sort((a, b) => a.seat - b.seat);

  /** One wall in the tray, picked up with a pointer and dropped on the board. */
  const trayPiece = (o: WallOrientation) => (
    <button
      type="button"
      disabled={!canBuild}
      onPointerDown={(e) => {
        if (!canBuild) return;
        // Stops a touch drag from scrolling the page away under the finger.
        e.preventDefault();
        // Capture keeps the moves coming to this element once the finger
        // leaves it. Guarded because a pointer id that is no longer active
        // throws, and losing capture is survivable — losing the drag is not.
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* keep dragging */ }
        setDragging(o);
        setSlot(slotAt(e.clientX, e.clientY));
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={() => { setDragging(null); setSlot(null); }}
      style={{ touchAction: 'none' }}
      className={`flex-1 h-16 rounded-xl border flex items-center justify-center transition-all ${
        canBuild
          ? dragging === o
            ? 'bg-white border-[#1A1F26]/25 shadow-sm cursor-grabbing'
            : 'bg-[#F8FAFC] border-[#E6E1DC] hover:bg-white hover:border-[#9e1316]/30 hover:shadow-sm cursor-grab'
          : 'bg-[#F8FAFC] border-transparent cursor-not-allowed'
      }`}
      aria-label={o === 'h' ? 'horizontal wall' : 'vertical wall'}
    >
      <TrayWall o={o} color={myColor} lit={canBuild} />
    </button>
  );

  const teams = gameState.settings.mode === 'teams';
  const winners = gameState.players.filter((p) => gameState.winnerIds.includes(p.id));
  const iWon = gameState.winnerIds.includes(userId);
  const showResult = isFinished && !resultHidden;

  // The turn clock as a bar: the header carries the digits, this shows at a
  // glance how much of the turn is gone, in the colour of whoever is on it.
  const turnDuration = gameState.settings.turnDuration || 30;
  const turnShare = Math.max(0, Math.min(1, timeLeft / turnDuration));
  const turnColor = turnPlayer ? colorFor(gameState, turnPlayer.seat) : '#8A9099';
  const hurry = gameState.status === 'playing' && timeLeft <= 5;

  useEscape(pendingResign, () => setPendingResign(false));
  useEscape(showResult, () => setResultHidden(true));

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#1A1F26] flex flex-col">
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].wallrush}
        themeColor="text-[#1A1F26]"
      />

      <GameHeader
        title="Wall Rush"
        icon={BrickWall}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
        accentColor="text-[#1A1F26]"
      />

      {/* Bottom padding is room for the chat button on a phone. */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-6 md:pt-8 pb-24 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] items-start">
        <section className="flex justify-center min-w-0">
          <div className="w-full max-w-[min(92vw,600px)]">
            {/* The board: white squares on a grey grid, square at the
                corners, with an outer line as wide as the gaps inside. The
                pointer maths reads the grid itself, not that line. */}
            <div
              className="relative"
              style={{ padding: `${edgePct}%`, backgroundColor: GRID_BG }}
            >
              {!racingToCentre && gameState.status !== 'waiting' && orderedPlayers.map(finishLine)}
              <div
                ref={boardRef}
                className="grid"
                style={{ gridTemplateColumns: track, gridTemplateRows: track }}
              >
                {board}
              </div>
            </div>
          </div>
        </section>

        <aside className="w-full max-w-[min(92vw,600px)] lg:max-w-none mx-auto space-y-4">
          {/* TURN — whose move it is, and how much of it is left */}
          <div className={`${CARD} p-4`}>
            <div className={`${LABEL} mb-3`}>{isFinished ? t.matchOver : t.turnLabel}</div>

            <div className="flex items-center gap-3">
              {!isFinished && turnPlayer && (
                <PlayerToken
                  className="w-9 h-9"
                  color={turnColor}
                  seat={turnPlayer.seat}
                  mine={turnPlayer.id === userId}
                />
              )}
              {isFinished && (
                <span
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    iWon ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-[#F8FAFC] text-[#1A1F26] border-[#E6E1DC]'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-lg font-black leading-tight truncate">
                  {isFinished
                    ? (iWon ? t.youWin : teams ? t.teamWins : t.winner)
                    : isMyTurn ? t.yourTurn : turnPlayer?.name ?? ''}
                </div>
                <div className="text-xs font-medium text-[#8A9099] mt-0.5 leading-snug">
                  {isFinished
                    ? winners.map((w) => w.name).join(' + ')
                    : isMyTurn ? t.moveHint : turnPlayer ? t.thinking : ''}
                </div>
              </div>

              {isFinished && resultHidden && (
                <button
                  onClick={() => setResultHidden(false)}
                  className="px-3 py-2 bg-[#1A1F26] text-white rounded-lg font-bold text-2xs uppercase tracking-wide hover:bg-[#9e1316] transition-colors shrink-0"
                >
                  {t.showResult}
                </button>
              )}
            </div>

            {gameState.status === 'playing' && (
              <div className="mt-4 h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${turnShare * 100}%`, backgroundColor: hurry ? '#9e1316' : softTone(turnColor) }}
                />
              </div>
            )}
          </div>

          {/* WALLS — the tray, and the way out */}
          {iResigned ? (
            // Out of the race, still at the table: the board keeps updating,
            // only the controls go.
            <div className={`${CARD} p-4 flex items-center gap-3`}>
              <span className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E6E1DC] flex items-center justify-center text-[#8A9099] shrink-0">
                <Eye className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold text-[#8A9099] leading-snug">{t.watching}</p>
            </div>
          ) : me && !isFinished && (
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className={LABEL}>{t.wallsLabel}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded tabular-nums ${
                    me.wallsLeft > 0 ? 'text-white bg-[#1A1F26]' : 'text-[#8A9099] bg-[#F1F5F9]'
                  }`}
                >
                  {me.wallsLeft}
                </span>
              </div>

              <div className="flex gap-3">
                {trayPiece('h')}
                {trayPiece('v')}
              </div>

              <p className="mt-3 text-xs font-medium text-[#8A9099] leading-snug">
                {me.wallsLeft === 0
                  ? t.noWalls
                  : dragging ? t.dropHint : canBuild ? t.dragHowTo : t.wallsOnYourTurn}
              </p>

              {canResign && (
                <div className="mt-4 pt-4 border-t border-[#F1F5F9] flex justify-end">
                  <button
                    onClick={() => setPendingResign(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-2xs font-bold uppercase tracking-widest text-[#8A9099] border border-[#E6E1DC] hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    {t.resign}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PLAYERS — each with the same piece they have on the board, so
              the list doubles as the legend */}
          <div className={`${CARD} p-4`}>
            <div className={`${LABEL} mb-3`}>{t.playersLabel}</div>

            <div className="space-y-1.5">
              {orderedPlayers.map((p) => {
                const active = !isFinished && p.id === gameState.turnPlayerId;
                const color = colorFor(gameState, p.seat);
                const out = resignedIds.has(p.id);
                const won = isFinished && gameState.winnerIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    className={`relative flex items-center gap-3 py-2.5 pl-3.5 pr-3 rounded-xl border transition-colors ${
                      active ? 'bg-[#F8FAFC] border-[#E6E1DC]' : 'border-transparent'
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-1 top-3 bottom-3 w-1 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}

                    <span className="relative w-9 h-9 shrink-0">
                      <Image
                        src={p.avatarUrl || defaultAvatar(p.id)}
                        alt=""
                        width={36}
                        height={36}
                        className={`w-full h-full object-cover rounded-full bg-[#F8FAFC] ${out ? 'grayscale opacity-60' : ''}`}
                      />
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-white p-[2px]">
                        <PlayerToken className="w-4 h-4" color={color} seat={p.seat} />
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold truncate ${out ? 'text-[#B5B3AD] line-through' : ''}`}>
                          {p.name}
                        </span>
                        {p.id === userId && (
                          <span className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] shrink-0">{t.you}</span>
                        )}
                        {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                        {won && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      </div>

                      <div className="flex items-center gap-2 mt-1 h-3">
                        {out ? (
                          <span className="text-2xs font-bold uppercase tracking-wider text-[#B5B3AD]">{t.resigned}</span>
                        ) : (
                          <>
                            {/* Walls as pips: read every turn, and faster than a number. */}
                            <span className="flex items-center gap-[3px]">
                              {Array.from({ length: p.wallsLeft }).map((_, i) => (
                                <span key={i} className="w-[3px] h-2.5 rounded-full" style={{ backgroundColor: softTone(color) }} />
                              ))}
                            </span>
                            <span className="text-2xs font-bold text-[#8A9099] tabular-nums">
                              {p.wallsLeft === 0 ? t.noWalls : p.wallsLeft}
                            </span>
                          </>
                        )}
                        {teams && (
                          <span className="ml-auto text-3xs font-bold text-[#8A9099] uppercase tracking-wider">
                            {teamOf(p.seat) === 0 ? t.teamA : t.teamB}
                          </span>
                        )}
                      </div>
                    </div>

                    {(p.score || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-2xs font-bold text-[#8A9099] shrink-0 tabular-nums">
                        <Trophy className="w-3 h-3" />{p.score}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </main>

      {/* RESIGN — in the app's own dialog, not the browser's */}
      {pendingResign && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.resignTitle}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#1A1F26]/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPendingResign(false)}
        >
          <div
            className="bg-white p-7 rounded-[24px] w-full max-w-sm text-center shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-[#1A1F26] mb-1">{t.resignTitle}</h3>
            <p className="text-sm font-medium text-[#8A9099] mb-6 leading-snug">
              {/* Say what actually happens: in a duel it ends the match. */}
              {stillRacing <= 2 && !teams ? t.resignDescDuel : t.resignDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingResign(false)}
                className="flex-1 py-3 bg-white text-[#1A1F26] border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:border-[#9e1316]/30 hover:shadow-sm transition-all"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { setPendingResign(false); resign(); }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black uppercase text-xs hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                {t.resign}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT — can be put aside to look at the final position */}
      {showResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.matchOver}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1F26]/50 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-[24px] w-full max-w-sm border border-[#E6E1DC] shadow-2xl p-7 text-center animate-in zoom-in-95">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                iWon ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-[#F8FAFC] text-[#1A1F26] border-[#E6E1DC]'
              }`}
            >
              <Trophy className="w-7 h-7" />
            </div>

            <div className={`${LABEL} mb-1`}>{t.matchOver}</div>
            <h3 className="text-2xl font-black mb-4">
              {iWon ? t.youWin : teams ? t.teamWins : t.winner}
            </h3>

            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {winners.map((w) => (
                <span key={w.id} className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E6E1DC] rounded-xl px-3 py-2">
                  <PlayerToken className="w-5 h-5" color={colorFor(gameState, w.seat)} seat={w.seat} />
                  <span className="text-sm font-bold">{w.name}</span>
                </span>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={leaveGame}
                className="flex-1 py-3 bg-white border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs text-[#1A1F26] hover:border-[#9e1316]/30 hover:shadow-sm transition-all"
              >
                {t.toMenu}
              </button>
              {/* Whoever presses second joins the room the first one opened. */}
              <RematchButton
                gameId="wallrush"
                parentState={gameState}
                lang={lang}
                className="flex-1 py-3 bg-[#1A1F26] text-white rounded-xl font-black uppercase text-xs hover:bg-[#9e1316] transition-colors"
              />
            </div>

            <button
              onClick={() => setResultHidden(true)}
              className="mt-4 text-2xs font-bold uppercase tracking-widest text-[#8A9099] hover:text-[#9e1316] transition-colors"
            >
              {t.viewBoard}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
