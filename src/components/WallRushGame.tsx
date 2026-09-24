'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { BrickWall, Crown, Flag, Trophy } from 'lucide-react';
import type { Cell, Wall, WallOrientation, WallRushPlayer, WallRushState } from '@/types/wallrush';
import {
  GOAL_FOR_MODE, canPlaceWall, centreCell, isGoal, legalMoves, moveInDirection, sameCell, seatsForMode, teamOf
} from '@/lib/gameLogic/wallrush';
import { useGameKeys } from '@/hooks/useGameKeys';
import { directionOf, isEscape, isRotate } from '@/lib/keys';
import { wallKey, wallReaches, type WallReach } from '@/lib/gameLogic/wallrushJoints';
import PlayerToken, { PlayerLegend } from './PlayerToken';
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
    dragHint: 'Тяните на доску',
    yourTurn: 'Ваш ход',
    waitingFor: 'Ходит',
    youWin: 'Победа',
    teamWins: 'Победила пара',
    winner: 'Победитель',
    toMenu: 'В меню',
    noWalls: 'Стены кончились',
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
    dragHint: 'Drag onto the board',
    yourTurn: 'Your turn',
    waitingFor: 'Now playing',
    youWin: 'You win',
    teamWins: 'Team wins',
    winner: 'Winner',
    toMenu: 'Main menu',
    noWalls: 'Out of walls',
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

/** Walls take the colour of whoever placed them; pieces their seat colour. */
const colorFor = (state: WallRushState, seat: number) =>
  (state.settings.mode === 'teams' ? TEAM_COLORS : SEAT_COLORS)[seat % 4];

/** Width of a groove as a fraction of a cell. */
const GUTTER_FR = 0.34;

/** Width of the board's rim, in the same units — a little wider than a groove. */
const FRAME_FR = 0.46;

/**
 * One groove as a percentage of a wall's own length (cell + groove + cell),
 * which is what an absolutely placed bar's offsets are measured against.
 */
const GROOVE_OF_WALL_PCT = (GUTTER_FR / (2 + GUTTER_FR)) * 100;

/** The board: grooves and rim are one surface, the cells are tiles set into it. */
const BOARD_BG = '#E3DDD1';
const TILE_BG = '#FBFAF7';

/**
 * A wall, drawn as brickwork, filling whatever box it is given.
 *
 * On the board that box is the whole groove, so the wall sits flush against
 * the tiles on either side instead of floating in the middle of a gap. The
 * pattern is two courses with the joints staggered, the way bricks are laid —
 * a single row of evenly spaced lines reads as a ladder — and the bricks are
 * sized from the wall's own thickness (container units), so they keep their
 * proportions from a phone to a desktop.
 */
function WallBar({
  o, color, style, className = ''
}: { o: WallOrientation; color: string; style?: React.CSSProperties; className?: string }) {
  const horizontal = o === 'h';

  // Mortar is a dark line, not a light one: against a saturated seat colour a
  // white joint bleaches the wall and it reads as hatching rather than brick.
  const brick = horizontal ? '130cqh' : '130cqw';
  const course = (shift: boolean): React.CSSProperties => ({
    backgroundColor: color,
    backgroundImage: `linear-gradient(${horizontal ? '90deg' : '180deg'}, rgba(0,0,0,0.28) 0 1.5px, transparent 1.5px)`,
    backgroundSize: horizontal ? `${brick} 100%` : `100% ${brick}`,
    // Half a brick, so no joint sits above another.
    backgroundPosition: shift ? (horizontal ? '65cqh 0' : '0 65cqw') : '0 0'
  });

  return (
    <span
      className={`flex overflow-hidden rounded-[1.5px] ${horizontal ? 'flex-col' : 'flex-row'} ${className}`}
      style={{
        containerType: 'size',
        // Lit from above: a highlight on the top edge, a shadow falling on
        // the tiles — enough to read as a piece laid on the board.
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.28)',
        ...style
      }}
    >
      <span className="flex-1" style={course(false)} />
      <span
        className={`flex-1 ${horizontal ? 'border-t' : 'border-l'} border-black/20`}
        style={course(true)}
      />
    </span>
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
   * The rim as a percentage of the board's width. Padding percentages are
   * measured against width on every side, and the board is square, so one
   * number places the rim, and the finish lines inside it, on all four.
   */
  const rimPct = (FRAME_FR / (units + 2 * FRAME_FR)) * 100;

  /** A finish line in the rim along the edge a player is racing to. */
  const finishLine = (p: WallRushPlayer) => {
    const edge = goalEdge(sides[p.seat]);
    const across = edge === 'top' || edge === 'bottom';
    return (
      <span
        key={`goal${p.id}`}
        aria-hidden
        className="absolute rounded-full"
        style={{
          backgroundColor: colorFor(gameState, p.seat),
          [edge]: `${rimPct * 0.28}%`,
          ...(across
            ? { left: `${rimPct}%`, right: `${rimPct}%`, height: `${rimPct * 0.44}%` }
            : { top: `${rimPct}%`, bottom: `${rimPct}%`, width: `${rimPct * 0.44}%` })
        }}
      />
    );
  };

  const goalOwner = (cell: Cell): WallRushPlayer | undefined =>
    gameState.status !== 'waiting' && !racingToCentre
      ? gameState.players.find((p) => isGoal(sides[p.seat], cell, size, goal))
      : undefined;

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
      const owner = goalOwner(cell);
      const isCentre = racingToCentre && sameCell(cell, centre);

      // A goal row is washed faintly in its owner's colour; the rim beside it
      // carries the solid line.
      const goalTint = owner ? colorFor(gameState, owner.seat) : null;

      board.push(
        <button
          key={`c${x},${y}`}
          type="button"
          disabled={!isTarget}
          onClick={() => isTarget && movePawn(cell)}
          style={{
            gridColumn: 2 * x + 1,
            gridRow: 2 * y + 1,
            // Square tiles: a wall is square-ended and fills the groove, so
            // any rounding here shows as a notch of board between the two.
            backgroundColor: isCentre
              ? '#FEF3C7'
              : isTarget
                ? `color-mix(in srgb, ${myColor} 14%, ${TILE_BG})`
                : goalTint
                  ? `color-mix(in srgb, ${goalTint} 7%, ${TILE_BG})`
                  : TILE_BG,
            // Set into the board: a lit top edge and a slightly darker foot.
            boxShadow: isCentre
              ? 'inset 0 0 0 2px #FBBF24'
              : 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(0,0,0,0.06)'
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
        o={w.o}
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
      className={`flex-1 h-16 rounded-2xl flex items-center justify-center transition-colors ${
        canBuild
          ? dragging === o
            ? 'bg-[#E4E1D8] cursor-grabbing'
            : 'bg-[#F4F3F0] hover:bg-[#EDEBE5] cursor-grab'
          : 'bg-[#F8F8F6] cursor-not-allowed'
      }`}
      aria-label={o === 'h' ? 'horizontal wall' : 'vertical wall'}
    >
      <WallBar
        o={o}
        color={canBuild ? myColor : '#D8D6D0'}
        className={o === 'h' ? 'w-14 h-4' : 'w-4 h-12'}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1F26] flex flex-col">
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

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-8">
        <section className="flex-1 flex flex-col items-center min-w-0">
          <div className="w-full max-w-[min(92vw,560px)]">
            {/* The board: one stone surface — rim and grooves — with the
                tiles set into it. The pointer maths reads the grid itself,
                not the rim around it. */}
            <div
              className="relative rounded-2xl"
              style={{
                padding: `${rimPct}%`,
                backgroundColor: BOARD_BG,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)'
              }}
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

            {/* LEGEND — which piece on the board is whose */}
            <PlayerLegend
              className="mt-4"
              players={orderedPlayers}
              currentUserId={userId}
              colorOf={(seat) => colorFor(gameState, seat)}
            />

            {iResigned ? (
              // Out of the race, still at the table: the board keeps updating,
              // only the controls go.
              <div className="mt-4 py-5 rounded-2xl bg-[#F4F3F0] text-center text-sm font-bold text-[#8A9099]">
                {t.watching}
              </div>
            ) : (
              <>
              {/* TRAY — two walls, always in reach; moving needs no tool at all */}
              <div className="mt-4 flex items-center gap-3">
                {trayPiece('h')}
                {trayPiece('v')}
                <div className="w-28 shrink-0 text-right">
                  <div
                    className="text-2xl font-black tabular-nums leading-none"
                    style={{ color: canBuild ? myColor : '#C4C2BC' }}
                  >
                    {me?.wallsLeft ?? 0}
                  </div>
                  <div className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider mt-1 leading-tight">
                    {dragging ? t.dragHint : me?.wallsLeft === 0 ? t.noWalls : ''}
                  </div>
                </div>
              </div>
              </>
            )}

            {canResign && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setPendingResign(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-2xs font-bold uppercase tracking-widest text-[#8A9099] border border-transparent hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  {t.resign}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SIDEBAR */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="text-sm font-bold text-center lg:text-left">
            {isFinished
              ? t.winner
              : isMyTurn
                ? <span style={{ color: myColor }}>{t.yourTurn}</span>
                : <span className="text-[#8A9099]">{turnPlayer ? `${t.waitingFor}: ${turnPlayer.name}` : ''}</span>}
          </div>

          <div className="space-y-1">
            {orderedPlayers.map((p) => {
              const active = p.id === gameState.turnPlayerId;
              const color = colorFor(gameState, p.seat);

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors ${
                    active ? 'bg-[#F4F3F0]' : ''
                  }`}
                >
                  <span className="relative w-8 h-8 shrink-0">
                    <Image
                      src={p.avatarUrl || defaultAvatar(p.id)}
                      alt=""
                      width={32}
                      height={32}
                      className="w-full h-full object-cover rounded-full"
                    />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: color }}
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold truncate ${resignedIds.has(p.id) ? 'text-[#B5B3AD] line-through' : ''}`}>{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                      {resignedIds.has(p.id) && (
                        <span className="text-3xs font-bold uppercase tracking-wider text-[#B5B3AD] shrink-0">{t.resigned}</span>
                      )}
                      {(p.score || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-2xs font-bold text-[#8A9099] shrink-0">
                          <Trophy className="w-3 h-3" />{p.score}
                        </span>
                      )}
                    </div>

                    {/* Walls as pips: read every turn, and faster than a number. */}
                    <div className="flex items-center gap-[3px] mt-1 h-3">
                      {Array.from({ length: p.wallsLeft }).map((_, i) => (
                        <span key={i} className="w-[3px] h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                      {p.wallsLeft === 0 && (
                        <span className="text-2xs font-medium text-[#C4C2BC]">{t.noWalls}</span>
                      )}
                      {gameState.settings.mode === 'teams' && (
                        <span className="ml-2 text-3xs font-bold text-[#8A9099] uppercase">
                          {teamOf(p.seat) === 0 ? t.teamA : t.teamB}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
            className="bg-white p-7 rounded-3xl w-full max-w-xs text-center shadow-2xl border border-[#E6E1DC] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-[#1A1F26] uppercase mb-1">{t.resignTitle}</h3>
            <p className="text-xs font-bold text-[#8A9099] mb-6">
              {/* Say what actually happens: in a duel it ends the match. */}
              {stillRacing <= 2 && gameState.settings.mode !== 'teams' ? t.resignDescDuel : t.resignDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingResign(false)}
                className="flex-1 py-3 bg-[#F8FAFC] text-[#1A1F26] border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:bg-[#E6E1DC] transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => { setPendingResign(false); resign(); }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold uppercase text-xs hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                {t.resign}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT */}
      {isFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs border border-[#E6E1DC] shadow-xl p-6 text-center animate-in zoom-in-95">
            <h3 className="text-lg font-black uppercase tracking-wide mb-1">
              {gameState.winnerIds.includes(userId)
                ? t.youWin
                : gameState.settings.mode === 'teams'
                  ? t.teamWins
                  : t.winner}
            </h3>

            <p className="text-sm font-medium text-[#8A9099] mb-6">
              {gameState.players
                .filter((p) => gameState.winnerIds.includes(p.id))
                .map((w) => w.name)
                .join(' + ')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={leaveGame}
                className="flex-1 py-3 border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:bg-[#F8FAFC] transition-colors"
              >
                {t.toMenu}
              </button>
              {/* Whoever presses second joins the room the first one opened. */}
              <RematchButton
                gameId="wallrush"
                parentState={gameState}
                lang={lang}
                className="flex-1 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-xs hover:opacity-90 transition-opacity"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
