'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Bomb, Flag, Trophy,
  ZoomIn, ZoomOut, Loader2,
  MousePointer2, Zap, Skull, UserX
} from 'lucide-react';
import { MinesweeperState, MinesweeperPlayer, Cell } from '@/types/minesweeper';
import GameHeader from './GameHeader';
import GameNotificationToast from './GameNotificationToast';
import { requireGame } from '@/games/registry';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import ResultDialog from './game/ResultDialog';
import { BUTTON_PRIMARY } from './game/ui';
import { playSfx } from '@/lib/sound';
import { useGameKeys } from '@/hooks/useGameKeys';
import { directionOf, isSpace, isZoomIn, isZoomOut, isZoomReset } from '@/lib/keys';

// --- THEME & STYLES ---
// Closed tiles are the grid grey, raised; opened ones are white — the same
// white-on-grey every board uses.
const COLORS = {
  hidden: "bg-[#E6E1DC] border-b-4 border-r-4 border-[#CFC8BA] hover:brightness-95 active:border-b-0 active:border-r-0 active:border-t-2 active:border-l-2",
  open: "bg-white",
  flagged: "bg-[#E6E1DC] border-b-4 border-r-4 border-[#CFC8BA]",
  mine: "bg-[#9e1316] text-white border-none shadow-inner",
  numbers: [
    "",
    "text-blue-600", "text-emerald-600", "text-red-600", "text-indigo-700",
    "text-amber-700", "text-cyan-700", "text-black", "text-gray-600"
  ]
};

const UI_TEXT = {
  ru: {
    title: 'MINESWEEPER',
    pro: 'by Darhaal',
    mines: 'МИНЫ',
    time: 'ВРЕМЯ',
    victory: 'ПОБЕДА',
    defeat: 'ВЗРЫВ',
    leave: 'ВЫЙТИ',
    start: 'НАЧАТЬ',
    waiting: 'ОЖИДАНИЕ...',
    you: '(Вы)',
    results: 'РЕЗУЛЬТАТЫ',
    player: 'Игрок',
    status: 'Статус',
    progress: 'Прогресс',
    timeStat: 'Время',
    dig: 'Копать',
    flag: 'Флаг',
    won: 'ПОБЕДА',
    dead: 'МЕРТВ',
    alive: 'В ИГРЕ',
    left: 'ВЫШЕЛ',
    viewBoard: 'СМОТРЕТЬ КАРТУ',
    showResults: 'Итоги',
    matchClock: 'матч',
    youWin: 'Победа',
    winnerLabel: 'Победитель',
    nobody: 'Поле никто не прошёл',
    minesLeft: 'мин осталось'
  },
  en: {
    title: 'MINESWEEPER',
    pro: 'by Darhaal',
    mines: 'MINES',
    time: 'TIME',
    victory: 'VICTORY',
    defeat: 'DEFEAT',
    leave: 'LEAVE',
    start: 'START',
    waiting: 'WAITING...',
    you: '(You)',
    results: 'RESULTS',
    player: 'Player',
    status: 'Status',
    progress: 'Progress',
    timeStat: 'Time',
    dig: 'Dig',
    flag: 'Flag',
    won: 'WON',
    dead: 'DEAD',
    alive: 'ALIVE',
    left: 'LEFT',
    viewBoard: 'VIEW BOARD',
    showResults: 'Results',
    matchClock: 'match',
    youWin: 'You win',
    winnerLabel: 'Winner',
    nobody: 'Nobody cleared the field',
    minesLeft: 'mines left'
  }
};

interface MinesweeperGameProps {
  gameState: MinesweeperState;
  userId: string;
  revealCell: (x: number, y: number) => void;
  toggleFlag: (x: number, y: number) => void;
  chordCell: (x: number, y: number) => void;
  startGame: () => void;
  leaveGame: () => void;
  handleTimeout?: () => void;
  forceTimeUp?: () => void;
  lang: 'ru' | 'en';
}

const CellComponent = memo(({
    cell, onContextMenu, onAuxClick, onPointerDown, onPointerUp, onPointerLeave
}: {
    cell: Cell,
    onContextMenu: (e: React.MouseEvent) => void,
    onAuxClick: (e: React.MouseEvent) => void,
    onPointerDown: (e: React.PointerEvent) => void,
    onPointerUp: (e: React.PointerEvent) => void,
    onPointerLeave: (e: React.PointerEvent) => void
}) => {
  let content = null;
  let styleClass = COLORS.hidden;

  if (cell.isOpen) {
    styleClass = COLORS.open;
    if (cell.isMine) {
      styleClass = COLORS.mine;
      content = <Bomb className="w-3/5 h-3/5 fill-current animate-bounce" />;
    } else if (cell.neighborCount > 0) {
      content = <span className={`font-black text-sm sm:text-base md:text-lg select-none ${COLORS.numbers[cell.neighborCount]}`}>{cell.neighborCount}</span>;
    }
  } else if (cell.isFlagged) {
    styleClass = COLORS.flagged;
    content = <Flag className="w-3/5 h-3/5 text-[#9e1316] fill-[#9e1316]" />;
  }

  return (
    <div
      data-cell
      data-x={cell.x}
      data-y={cell.y}
      onContextMenu={onContextMenu}
      onAuxClick={onAuxClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`${styleClass} w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer transition-none select-none relative`}
    >
      {content}
    </div>
  );
});
CellComponent.displayName = 'Cell';

// --- BOARD VIEW ---
interface BoardViewProps {
  player: MinesweeperPlayer;
  /** Status words for the chip in the board's header, in the reader's language. */
  statusText: { won: string; dead: string; left: string };
  isMe: boolean;
  onReveal: (x: number, y: number) => void;
  onFlag: (x: number, y: number) => void;
  onChord: (x: number, y: number) => void;
  scale?: number;
  isTouchModeFlag?: boolean;
  /** «(Вы)» / "(You)" — the board knows who it belongs to, not the language. */
  youLabel?: string;
}

const BoardView = ({ player, statusText, isMe, onReveal, onFlag, onChord, scale = 1, isTouchModeFlag, youLabel }: BoardViewProps) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag logic
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Long press logic
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  // Cell under the initial pointerdown. Cell activation happens on pointerup:
  // the pan container takes pointer capture, which retargets the composed
  // `click` event to the container — a cell-level onClick never fires.
  const pressedCell = useRef<Cell | null>(null);

  const clampOffset = (newX: number, newY: number, z: number) => {
      if (!player.board[0]) return { x: 0, y: 0 };
      const boardW = player.board[0].length * 32 * z * scale;
      const boardH = player.board.length * 32 * z * scale;
      const limitX = boardW / 1.5 + 100;
      const limitY = boardH / 1.5 + 100;
      return {
          x: Math.max(-limitX, Math.min(limitX, newX)),
          y: Math.max(-limitY, Math.min(limitY, newY))
      };
  };

  // Where the pointer last was over the board, so Space can act on the cell
  // under it — the keyboard has no cursor of its own.
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const cellUnderPointer = (): Cell | null => {
      const at = lastPointer.current;
      if (!at) return null;
      const el = document.elementFromPoint(at.x, at.y)?.closest<HTMLElement>('[data-cell]');
      if (!el) return null;
      return player.board[Number(el.dataset.y)]?.[Number(el.dataset.x)] ?? null;
  };

  /**
   * Keyboard, as the rules describe it:
   *   Space        flag / unflag the cell under the pointer; on an open
   *                number, open its neighbours (chord)
   *   WASD, arrows move around the board
   *   + / −        zoom; 0 puts the view back
   */
  useGameKeys(isMe && player.status === 'playing', (e) => {
      if (isSpace(e)) {
          if (e.repeat) return true; // holding the key must not flip the flag back and forth
          const cell = cellUnderPointer();
          if (!cell) return true;
          if (!cell.isOpen) onFlag(cell.x, cell.y);
          else if (cell.neighborCount > 0) onChord(cell.x, cell.y);
          return true;
      }

      const dir = directionOf(e);
      if (dir) {
          const step = 40 / zoom;
          const dx = dir === 'left' ? step : dir === 'right' ? -step : 0;
          const dy = dir === 'up' ? step : dir === 'down' ? -step : 0;
          setOffset(clampOffset(offset.x + dx, offset.y + dy, zoom));
          return true;
      }

      if (isZoomIn(e)) { setZoom(z => Math.min(4, z + 0.25)); return true; }
      if (isZoomOut(e)) { setZoom(z => Math.max(0.5, z - 0.25)); return true; }
      if (isZoomReset(e)) { setZoom(1); setOffset({ x: 0, y: 0 }); return true; }
  });

  // --- MOUSE / TOUCH HANDLERS ---

  const handlePointerDown = (e: React.PointerEvent, cell: Cell) => {
      if (!isMe || player.status !== 'playing') return;

      pressedCell.current = cell;

      // Start Long Press Timer (for mobile right click)
      isLongPress.current = false;
      if (e.pointerType === 'touch' && !cell.isOpen) {
          longPressTimer.current = setTimeout(() => {
              isLongPress.current = true;
              if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
              onFlag(cell.x, cell.y);
          }, 400); // 400ms long press
      }
  };

  const handlePointerUp = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handlePointerLeave = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleAuxClick = (e: React.MouseEvent, cell: Cell) => {
      if (e.button === 1) { // Middle Click
          e.preventDefault();
          if (cell.isOpen) {
              onChord(cell.x, cell.y);
          }
      }
  };

  const handleContextMenu = (e: React.MouseEvent, cell: Cell) => {
      e.preventDefault();
      if (hasMoved.current) return;
      if (!isMe || player.status !== 'playing') return;
      onFlag(cell.x, cell.y);
  };

  // --- BOARD DRAG ---
  const onContainerPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Only left click drags
      isDragging.current = true;
      hasMoved.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      startOffset.current = { ...offset };
      try { containerRef.current?.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  };

  const onContainerPointerMove = (e: React.PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      if (!isDragging.current) return;
      const dx = (e.clientX - dragStart.current.x) / zoom;
      const dy = (e.clientY - dragStart.current.y) / zoom;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;
      const nextX = startOffset.current.x + dx;
      const nextY = startOffset.current.y + dy;
      setOffset(clampOffset(nextX, nextY, zoom));
  };

  const onContainerPointerUp = (e: React.PointerEvent) => {
      isDragging.current = false;
      try { containerRef.current?.releasePointerCapture(e.pointerId); } catch { /* no capture */ }

      // Pointer capture retargets pointerup to the container, so the cell-level
      // handler never fires — clear the touch long-press timer here as well
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }

      // Activate the pressed cell (left button / touch tap only)
      const cell = pressedCell.current;
      pressedCell.current = null;
      if (e.button !== 0 || !cell) return;
      if (hasMoved.current || isLongPress.current) return;
      if (!isMe || player.status !== 'playing') return;

      if (!cell.isOpen) {
          if (isTouchModeFlag) {
              onFlag(cell.x, cell.y);
          } else if (!cell.isFlagged) {
              onReveal(cell.x, cell.y);
          }
      } else if (cell.neighborCount > 0) {
          // CHORD: click/tap on an opened number — when the right amount of
          // flags surrounds it, the hook opens all remaining neighbors
          onChord(cell.x, cell.y);
      }
  };

  // The wheel zooms the board, as it would a map. Attached by hand rather
  // than through onWheel: React registers wheel listeners as passive, so
  // preventDefault there is ignored and Ctrl + wheel zoomed the whole page
  // along with the board.
  useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          // Firefox can report lines rather than pixels.
          const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
          setZoom(z => Math.min(4, Math.max(0.5, z - dy * 0.001)));
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const statusChip =
    player.status === 'won' ? { text: statusText.won, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: Trophy }
    : player.status === 'lost' ? { text: statusText.dead, cls: 'bg-red-50 text-red-600 border-red-100', Icon: Skull }
    : player.status === 'left' ? { text: statusText.left, cls: 'bg-[#F1F5F9] text-[#8A9099] border-[#E6E1DC]', Icon: UserX }
    : null;

  return (
    <div className={`relative flex flex-col h-full bg-white rounded-2xl border border-[#E6E1DC] overflow-hidden shadow-sm ${player.status === 'left' ? 'grayscale opacity-75' : ''}`}>
        <div className="shrink-0 p-3 border-b border-[#F1F5F9] flex justify-between items-center gap-3 bg-white z-20">
            <div className="flex items-center gap-3 min-w-0">
                <Image src={player.avatarUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover bg-[#F8FAFC] shrink-0" />
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[#1A1F26] truncate">
                        {player.name}
                        {isMe && <span className="ml-1.5 text-3xs font-bold uppercase tracking-wider text-[#8A9099]">{youLabel}</span>}
                    </span>
                    <span className="flex items-center gap-1 text-2xs font-bold text-[#8A9099] tabular-nums">
                        <Flag className="w-3 h-3 text-[#9e1316]" /> {player.minesLeft}
                    </span>
                </div>
                {statusChip && (
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-2xs font-black uppercase tracking-wider shrink-0 ${statusChip.cls}`}>
                        <statusChip.Icon className="w-3 h-3" /> {statusChip.text}
                    </span>
                )}
            </div>
            {isMe && (
                <div className="flex gap-1 shrink-0">
                    <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} className="p-2 bg-white border border-[#E6E1DC] rounded-lg hover:border-[#9e1316]/30 transition-all" aria-label="zoom in"><ZoomIn className="w-4 h-4 text-[#8A9099]"/></button>
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-2 bg-white border border-[#E6E1DC] rounded-lg hover:border-[#9e1316]/30 transition-all" aria-label="zoom out"><ZoomOut className="w-4 h-4 text-[#8A9099]"/></button>
                </div>
            )}
        </div>

        <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative bg-[#F8FAFC] cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={onContainerPointerDown}
            onPointerMove={onContainerPointerMove}
            onPointerLeave={() => { lastPointer.current = null; }}
            onPointerUp={onContainerPointerUp}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div
                className="absolute transition-transform duration-75 ease-linear will-change-transform origin-center"
                style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom * scale})`,
                    left: '50%', top: '50%',
                    marginLeft: `-${(player.board[0]?.length * 32) / 2}px`,
                    marginTop: `-${(player.board.length * 32) / 2}px`
                }}
            >
                <div className="inline-grid gap-[2px] bg-[#D6D0C4] p-[2px] shadow-sm"
                     style={{ gridTemplateColumns: `repeat(${player.board[0]?.length || 10}, min-content)` }}>
                    {player.board.map((row: Cell[], y: number) => row.map((cell: Cell, x: number) => (
                        <CellComponent
                            key={`${x}-${y}`}
                            cell={cell}
                            onContextMenu={(e) => handleContextMenu(e, cell)}
                            onAuxClick={(e) => handleAuxClick(e, cell)}
                            onPointerDown={(e) => handlePointerDown(e, cell)}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerLeave}
                        />
                    )))}
                </div>
            </div>
        </div>

    </div>
  );
};

export default function MinesweeperGame({ gameState, userId, revealCell, toggleFlag, chordCell, startGame, leaveGame, handleTimeout, forceTimeUp, lang }: MinesweeperGameProps) {
  const [showRules, setShowRules] = useState(false);
  // Results manually dismissed for a specific match (keyed by the match startTime)
  const [resultsDismissedFor, setResultsDismissedFor] = useState<number | null>(null);
  const t = UI_TEXT[lang];
  const [timeLeft, setTimeLeft] = useState(gameState.settings.timeLimit || 600);
  const [isTouchModeFlag, setIsTouchModeFlag] = useState(false);

  const players = Object.values(gameState.players);
  const me = gameState.players[userId];
  const opponents = players.filter(p => p.id !== userId);

  // Derived state: show results when the match is finished and not dismissed
  const showResults = gameState.status === 'finished' && resultsDismissedFor !== gameState.startTime;


  // Own game outcome sound
  useEffect(() => {
      if (me?.status === 'won') playSfx('win');
      else if (me?.status === 'lost') playSfx('lose');
  }, [me?.status]);

  useEffect(() => {
      if (gameState.status !== 'playing') return;
      const interval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
          const remaining = Math.max(0, (gameState.settings.timeLimit || 600) - elapsed);
          setTimeLeft(remaining);
          if (remaining === 0) {
              if (me?.status === 'playing' && handleTimeout) handleTimeout();
              // Someone who closed their tab never times themselves out, and
              // the match only ends once nobody is still playing.
              else if (elapsed > (gameState.settings.timeLimit || 600) + 10 && forceTimeUp) forceTimeUp();
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [gameState.status, gameState.startTime, gameState.settings.timeLimit, me?.status, handleTimeout, forceTimeUp]);

  const getSortedPlayers = () => {
      return [...players].sort((a, b) => {
          if (a.status === 'won' && b.status !== 'won') return -1;
          if (b.status === 'won' && a.status !== 'won') return 1;
          if (a.status === 'won') return (a.score || 0) - (b.score || 0);
          const getProg = (p: MinesweeperPlayer) => p.board.flat().filter(c => c.isOpen && !c.isMine).length;
          return getProg(b) - getProg(a);
      });
  };

  const getProgress = (p: MinesweeperPlayer) => {
      const totalSafe = (gameState.settings.width * gameState.settings.height) - gameState.settings.minesCount;
      const opened = p.board.flat().filter(c => c.isOpen && !c.isMine).length;
      return Math.min(100, Math.round((opened / totalSafe) * 100));
  };

  const iWon = gameState.winnerId === userId;
  const winnerPlayer = gameState.winnerId ? gameState.players[gameState.winnerId] : undefined;
  const resultTitle = iWon ? t.youWin : gameState.winner ? t.winnerLabel : t.nobody;
  const statusText = { won: t.won, dead: t.dead, left: t.left };

  if (!me) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#9e1316]" /></div>;

  return (
    <div className="h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden">

        <GameRulesModal
            isOpen={showRules}
            onClose={() => setShowRules(false)}
            rules={GAME_RULES[lang as 'ru' | 'en'].minesweeper}
            themeColor="text-red-600"
        />

        <GameHeader
            title={requireGame('minesweeper').name[lang]}
            icon={Bomb}
            timeLeft={timeLeft}
            showTime={true}
            timeCaption={t.matchClock}
            onLeave={leaveGame}
            onShowRules={() => setShowRules(true)}
            lang={lang}
            accentColor="text-red-600"
       />

        <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

        {/* LOBBY CONTROLS */}
        <div className="flex justify-center pb-4 z-20 relative px-4 gap-4 mt-4">
             {gameState.status === 'waiting' && me.isHost && (
                <button onClick={startGame} className="bg-[#1A1F26] text-white px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-[#9e1316] transition-all shadow-lg hover:shadow-[#9e1316]/20 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> {t.start}
                </button>
            )}
            {gameState.status === 'waiting' && !me.isHost && (
                <div className="px-6 py-3 bg-[#F5F5F0] text-[#8A9099] font-bold text-xs uppercase rounded-2xl animate-pulse tracking-widest border border-[#E6E1DC]">
                    {t.waiting}
                </div>
            )}
            {gameState.status === 'finished' && !showResults && (
                <button onClick={() => setResultsDismissedFor(null)} className={`px-5 py-2.5 ${BUTTON_PRIMARY} animate-in zoom-in`}>
                    {t.showResults}
                </button>
            )}
            {/* TOUCH MODE TOGGLE */}
            <button
                  onClick={() => setIsTouchModeFlag(!isTouchModeFlag)}
                  className={`flex sm:hidden items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all border shadow-sm ${isTouchModeFlag ? 'bg-[#1A1F26] text-white border-[#1A1F26]' : 'bg-white text-[#1A1F26] border-[#E6E1DC]'}`}
              >
                  {isTouchModeFlag ? <Flag className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
                  <span>{isTouchModeFlag ? t.flag : t.dig}</span>
            </button>
        </div>

        <main className={`flex-1 px-4 pb-4 sm:px-6 sm:pb-6 grid gap-6 ${players.length === 1 ? 'grid-cols-1' : players.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2'} overflow-hidden`}>
            <div className={`relative ${players.length > 2 ? 'col-span-2 row-span-2 md:col-span-1 md:row-span-1' : ''}`}>
               <BoardView
                  player={me}
                  isMe={true}
                  onReveal={revealCell}
                  onFlag={toggleFlag}
                  onChord={chordCell}
                  isTouchModeFlag={isTouchModeFlag}
                  youLabel={t.you}
                  statusText={statusText}
               />
            </div>
            {opponents.map(p => (
                <div key={p.id} className="relative opacity-90 hover:opacity-100 transition-opacity">
                    <BoardView player={p} statusText={statusText} isMe={false} onReveal={()=>{}} onFlag={()=>{}} onChord={()=>{}} scale={players.length > 2 ? 0.8 : 1} />
                </div>
            ))}
        </main>

        <ResultDialog
            lang={lang}
            open={showResults}
            onHide={() => setResultsDismissedFor(gameState.startTime)}
            won={iWon}
            title={resultTitle}
            winners={winnerPlayer ? [{ id: winnerPlayer.id, name: winnerPlayer.name, avatarUrl: winnerPlayer.avatarUrl }] : []}
            gameId="minesweeper"
            parentState={gameState}
            onMenu={leaveGame}
            wide
        >
            <div className="divide-y divide-[#F1F5F9] border-y border-[#F1F5F9]">
                {getSortedPlayers().map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-3">
                        <Image src={p.avatarUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover bg-[#F8FAFC] shrink-0" />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold truncate">{p.name}</div>
                            <div className="text-2xs font-bold uppercase tracking-wider text-[#8A9099]">
                                {p.status === 'won' ? t.won : p.status === 'lost' ? t.dead : p.status === 'left' ? t.left : t.alive}
                            </div>
                        </div>
                        <div className="font-mono text-sm font-bold tabular-nums w-12 text-right">
                            {p.score ? `${Math.floor(p.score / 60)}:${(p.score % 60).toString().padStart(2, '0')}` : '—'}
                        </div>
                        <div className="flex items-center gap-2 w-24 justify-end">
                            <div className="w-12 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${p.status === 'lost' ? 'bg-red-500' : 'bg-[#1A1F26]'}`} style={{ width: `${getProgress(p)}%` }} />
                            </div>
                            <span className="text-xs font-black tabular-nums">{getProgress(p)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </ResultDialog>
    </div>
  );
}