'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { BrickWall, Eye, Flag, Trophy } from 'lucide-react';
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
import { requireGame } from '@/games/registry';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import {
  BUTTON_DANGER_QUIET, BUTTON_SECONDARY, DIALOG_OVERLAY, DIALOG_PANEL, GAME_PAGE, softTone
} from './game/ui';
import { GAME_RULES } from '@/constants/rules';
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
  const resultTitle = iWon ? t.youWin : teams ? t.teamWins : t.winner;
  const tokenOf = (p: WallRushPlayer) => ({ color: colorFor(gameState, p.seat), seat: p.seat });

  useEscape(pendingResign, () => setPendingResign(false));

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].wallrush}
        themeColor="text-[#1A1F26]"
      />

      <GameHeader
        title={requireGame('wallrush').name[lang]}
        icon={BrickWall}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
        accentColor="text-[#1A1F26]"
      />

      <GameLayout
        board={
          // White squares on a grey grid, square at the corners, with an
          // outer line as wide as the gaps inside. The pointer maths reads
          // the grid itself, not that line.
          <div className="relative" style={{ padding: `${edgePct}%`, backgroundColor: GRID_BG }}>
            {!racingToCentre && gameState.status !== 'waiting' && orderedPlayers.map(finishLine)}
            <div
              ref={boardRef}
              className="grid"
              style={{ gridTemplateColumns: track, gridTemplateRows: track }}
            >
              {board}
            </div>
          </div>
        }
        side={
          <>
            <TurnCard
              lang={lang}
              who={turnPlayer ? { name: turnPlayer.name, isMe: turnPlayer.id === userId, ...tokenOf(turnPlayer) } : null}
              hint={isMyTurn ? t.moveHint : turnPlayer ? t.thinking : undefined}
              secondsLeft={gameState.status === 'playing' ? timeLeft : undefined}
              turnSeconds={gameState.settings.turnDuration || 30}
              result={isFinished ? {
                won: iWon,
                title: resultTitle,
                detail: winners.map((w) => w.name).join(' + '),
                hidden: resultHidden,
                onShow: () => setResultHidden(false)
              } : undefined}
            />

            {/* WALLS — the tray, and the way out */}
            {iResigned ? (
              // Out of the race, still at the table: the board keeps
              // updating, only the controls go.
              <GameCard>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E6E1DC] flex items-center justify-center text-[#8A9099] shrink-0">
                    <Eye className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-bold text-[#8A9099] leading-snug">{t.watching}</p>
                </div>
              </GameCard>
            ) : me && !isFinished && (
              <GameCard
                label={t.wallsLabel}
                aside={
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded tabular-nums ${
                      me.wallsLeft > 0 ? 'text-white bg-[#1A1F26]' : 'text-[#8A9099] bg-[#F1F5F9]'
                    }`}
                  >
                    {me.wallsLeft}
                  </span>
                }
              >
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
                    <button onClick={() => setPendingResign(true)} className={`flex items-center gap-1.5 px-3.5 py-2 ${BUTTON_DANGER_QUIET}`}>
                      <Flag className="w-3.5 h-3.5" />
                      {t.resign}
                    </button>
                  </div>
                )}
              </GameCard>
            )}

            <PlayersCard
              lang={lang}
              rows={orderedPlayers.map((p) => {
                const out = resignedIds.has(p.id);
                return {
                  id: p.id,
                  name: p.name,
                  avatarUrl: p.avatarUrl,
                  isHost: p.isHost,
                  isMe: p.id === userId,
                  token: tokenOf(p),
                  active: !isFinished && p.id === gameState.turnPlayerId,
                  out,
                  won: isFinished && gameState.winnerIds.includes(p.id),
                  stat: (
                    <>
                      {out ? (
                        <span className="uppercase tracking-wider text-[#B5B3AD]">{t.resigned}</span>
                      ) : (
                        <>
                          {/* Walls as pips: read every turn, and faster than a number. */}
                          <span className="flex items-center gap-[3px]">
                            {Array.from({ length: p.wallsLeft }).map((_, i) => (
                              <span key={i} className="w-[3px] h-2.5 rounded-full" style={{ backgroundColor: softTone(tokenOf(p).color) }} />
                            ))}
                          </span>
                          <span className="tabular-nums">{p.wallsLeft === 0 ? t.noWalls : p.wallsLeft}</span>
                        </>
                      )}
                      {teams && (
                        <span className="ml-auto text-3xs uppercase tracking-wider">
                          {teamOf(p.seat) === 0 ? t.teamA : t.teamB}
                        </span>
                      )}
                    </>
                  ),
                  aside: (p.score || 0) > 0 ? <span className="flex items-center gap-0.5"><Trophy className="w-3 h-3" />{p.score}</span> : undefined
                };
              })}
            />
          </>
        }
      />

      {/* RESIGN — in the app's own dialog, not the browser's */}
      {pendingResign && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.resignTitle}
          className={DIALOG_OVERLAY}
          onClick={() => setPendingResign(false)}
        >
          <div className={`${DIALOG_PANEL} max-w-sm text-center`} onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Flag className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-[#1A1F26] mb-1">{t.resignTitle}</h3>
            <p className="text-sm font-medium text-[#8A9099] mb-6 leading-snug">
              {/* Say what actually happens: in a duel it ends the match. */}
              {stillRacing <= 2 && !teams ? t.resignDescDuel : t.resignDesc}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPendingResign(false)} className={`flex-1 py-3 ${BUTTON_SECONDARY}`}>
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

      <ResultDialog
        lang={lang}
        open={isFinished && !resultHidden}
        onHide={() => setResultHidden(true)}
        won={iWon}
        title={resultTitle}
        winners={winners.map((w) => ({ id: w.id, name: w.name, token: tokenOf(w) }))}
        gameId="wallrush"
        parentState={gameState}
        onMenu={leaveGame}
      />
    </div>
  );
}
