'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { BrickWall, Crown, Trophy } from 'lucide-react';
import type { Cell, Wall, WallOrientation, WallRushPlayer, WallRushState } from '@/types/wallrush';
import {
  GOAL_FOR_MODE, canPlaceWall, centreCell, isGoal, legalMoves, sameCell, seatsForMode, teamOf
} from '@/lib/gameLogic/wallrush';
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
    teamB: 'Пара B'
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
    teamB: 'Team B'
  }
};

/** Walls take the colour of whoever placed them; pieces their seat colour. */
const colorFor = (state: WallRushState, seat: number) =>
  (state.settings.mode === 'teams' ? TEAM_COLORS : SEAT_COLORS)[seat % 4];

/** Width of a wall gutter as a fraction of a cell. */
const GUTTER_FR = 0.34;

/** Bar proportions for a wall of the given orientation. */
const barShape = (o: WallOrientation) =>
  o === 'h' ? 'h-[26%] w-[92%]' : 'w-[26%] h-[92%]';

export default function WallRushGame({
  gameState, userId, movePawn, placeWall, handleTimeout, leaveGame, lang
}: WallRushGameProps) {
  const t = UI_TEXT[lang];
  const [showRules, setShowRules] = useState(false);
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

  const pawnAt = (cell: Cell): WallRushPlayer | undefined =>
    gameState.players.find((p) => gameState.pawns[p.id] && sameCell(gameState.pawns[p.id], cell));

  /**
   * Which outer edge a goal square sits on, so the marker is a line rather
   * than a box. Capitalised because it is spliced into a camelCase style key —
   * `borderbottom` is silently ignored by React, `borderBottom` is not.
   */
  const goalEdge = (side: string): 'Bottom' | 'Top' | 'Right' | 'Left' =>
    side === 'north' ? 'Bottom' : side === 'south' ? 'Top' : side === 'west' ? 'Right' : 'Left';

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

      board.push(
        <button
          key={`c${x},${y}`}
          type="button"
          disabled={!isTarget}
          onClick={() => isTarget && movePawn(cell)}
          style={{
            gridColumn: 2 * x + 1,
            gridRow: 2 * y + 1,
            // A line along the outer edge in the owner's colour, rather than a
            // ring around every square — a ring made the end rows look like a
            // separate strip of boxes.
            ...(owner
              ? { [`border${goalEdge(sides[owner.seat])}`]: `3px solid ${colorFor(gameState, owner.seat)}` }
              : {})
          }}
          className={`relative aspect-square rounded-[3px] transition-colors ${
            isCentre
              ? 'bg-amber-50 ring-1 ring-amber-400'
              : isTarget
                ? 'bg-[#E4E1D8] cursor-pointer hover:bg-[#DAD6CB]'
                : 'bg-[#EFEDE7]'
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

  // Walls already on the board, in the colour of whoever built them.
  for (const w of gameState.walls) {
    board.push(
      <span
        key={`w${w.o}${w.x},${w.y}`}
        aria-hidden
        style={
          w.o === 'h'
            ? { gridColumn: `${2 * w.x + 1} / span 3`, gridRow: 2 * w.y + 2 }
            : { gridColumn: 2 * w.x + 2, gridRow: `${2 * w.y + 1} / span 3` }
        }
        className="flex items-center justify-center pointer-events-none"
      >
        <span className={`rounded-full ${barShape(w.o)}`} style={{ backgroundColor: wallColor(w) }} />
      </span>
    );
  }

  /**
   * The piece under the pointer, drawn with the same grid placement a real
   * wall gets — spanning three tracks rather than one gutter, so what you see
   * while dragging is the size of what you are about to place.
   */
  if (dragging && slot && canDropHere) {
    board.push(
      <span
        key="preview"
        aria-hidden
        style={
          dragging === 'h'
            ? { gridColumn: `${2 * slot.x + 1} / span 3`, gridRow: 2 * slot.y + 2 }
            : { gridColumn: 2 * slot.x + 2, gridRow: `${2 * slot.y + 1} / span 3` }
        }
        className="flex items-center justify-center pointer-events-none"
      >
        <span
          className={`rounded-full ${barShape(dragging)} opacity-60`}
          style={{ backgroundColor: myColor }}
        />
      </span>
    );
  }

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
      <span
        className={`rounded-full ${o === 'h' ? 'w-12 h-2.5' : 'w-2.5 h-12'}`}
        style={{ backgroundColor: canBuild ? myColor : '#D8D6D0' }}
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
            <div ref={boardRef} className="relative">
              <div className="grid" style={{ gridTemplateColumns: track, gridTemplateRows: track }}>
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
                <div className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider mt-1 leading-tight">
                  {dragging ? t.dragHint : me?.wallsLeft === 0 ? t.noWalls : ''}
                </div>
              </div>
            </div>
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
                      <span className="text-xs font-bold truncate">{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                      {(p.score || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#8A9099] shrink-0">
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
                        <span className="text-[10px] font-medium text-[#C4C2BC]">{t.noWalls}</span>
                      )}
                      {gameState.settings.mode === 'teams' && (
                        <span className="ml-2 text-[9px] font-bold text-[#8A9099] uppercase">
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
                className="flex-1 py-3 border border-[#E6E1DC] rounded-xl font-bold uppercase text-[11px] hover:bg-[#F8FAFC] transition-colors"
              >
                {t.toMenu}
              </button>
              {/* Whoever presses second joins the room the first one opened. */}
              <RematchButton
                gameId="wallrush"
                parentState={gameState}
                lang={lang}
                className="flex-1 py-3 bg-[#1A1F26] text-white rounded-xl font-bold uppercase text-[11px] hover:opacity-90 transition-opacity"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
