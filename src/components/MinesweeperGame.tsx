'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Bomb, Flag, Trophy,
  ZoomIn, ZoomOut, Loader2, Eye,
  MousePointer2, Zap, Skull, UserX
} from 'lucide-react';
import { MinesweeperState, MinesweeperPlayer, Cell } from '@/types/minesweeper';
import GameHeader from './GameHeader';
import RematchButton from './RematchButton';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { playSfx } from '@/lib/sound';
import { useEscape } from '@/hooks/useEscape';

// --- THEME & STYLES ---
const COLORS = {
  hidden: "bg-slate-200 border-b-4 border-r-4 border-slate-300 hover:brightness-95 active:border-b-0 active:border-r-0 active:border-t-2 active:border-l-2 active:bg-slate-300",
  open: "bg-[#E6E1DC] border-[0.5px] border-slate-300 shadow-inner",
  flagged: "bg-slate-200 border-b-4 border-r-4 border-slate-300",
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
    showResults: 'ИТОГИ'
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
    showResults: 'RESULTS'
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
      onContextMenu={onContextMenu}
      onAuxClick={onAuxClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`${styleClass} w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center cursor-pointer transition-none rounded-sm sm:rounded-md select-none relative`}
    >
      {content}
    </div>
  );
});
CellComponent.displayName = 'Cell';

// --- BOARD VIEW ---
interface BoardViewProps {
  player: MinesweeperPlayer;
  isMe: boolean;
  onReveal: (x: number, y: number) => void;
  onFlag: (x: number, y: number) => void;
  onChord: (x: number, y: number) => void;
  scale?: number;
  isTouchModeFlag?: boolean;
}

const BoardView = ({ player, isMe, onReveal, onFlag, onChord, scale = 1, isTouchModeFlag }: BoardViewProps) => {
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

  // Keyboard navigation
  useEffect(() => {
      if (!isMe) return;
      const handleKeyDown = (e: KeyboardEvent) => {
          if (player.status !== 'playing') return;
          const step = 40 / zoom;
          let newX = offset.x;
          let newY = offset.y;
          switch(e.code) {
              case 'KeyW': newY += step; break;
              case 'KeyS': newY -= step; break;
              case 'KeyA': newX += step; break;
              case 'KeyD': newX -= step; break;
              case 'Equal':
              case 'NumpadAdd': setZoom(z => Math.min(4, z + 0.25)); return;
              case 'Minus':
              case 'NumpadSubtract': setZoom(z => Math.max(0.5, z - 0.25)); return;
              default: return;
          }
          setOffset(clampOffset(newX, newY, zoom));
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clampOffset is recreated each render; re-binding the key listener every render is unnecessary
  }, [isMe, zoom, offset, player.status]);

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

  const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || !isMe) {
          e.preventDefault();
          const delta = -e.deltaY * 0.001;
          const nextZoom = Math.min(Math.max(0.5, zoom + delta), 4);
          setZoom(nextZoom);
      }
  };

  const borderColor = player.status === 'won' ? 'border-emerald-500 shadow-emerald-500/20' : (player.status === 'lost' || player.status === 'left') ? 'border-red-500 shadow-red-500/20' : 'border-[#E6E1DC] shadow-[#1A1F26]/5';
  const overlayOpacity = (player.status === 'left') ? 'grayscale opacity-75' : '';

  return (
    <div className={`relative flex flex-col h-full bg-white rounded-[32px] border-4 overflow-hidden shadow-xl transition-all ${borderColor} ${overlayOpacity}`}>
        <div className="shrink-0 p-3 border-b border-[#F1F5F9] flex justify-between items-center bg-white/90 backdrop-blur-md z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden relative">
                    <Image src={player.avatarUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    {player.status === 'won' && <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center animate-in zoom-in"><Trophy className="w-5 h-5 text-white" /></div>}
                    {player.status === 'lost' && <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center animate-in zoom-in"><Skull className="w-5 h-5 text-white" /></div>}
                    {player.status === 'left' && <div className="absolute inset-0 bg-gray-500/80 flex items-center justify-center animate-in zoom-in"><UserX className="w-5 h-5 text-white" /></div>}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-black uppercase text-[#1A1F26] truncate max-w-[100px]">{player.name} {isMe && '(Вы)'}</span>
                    <span className="flex items-center gap-1 text-2xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                        <Flag className="w-3 h-3 text-[#9e1316]" /> {player.minesLeft}
                    </span>
                </div>
            </div>
            {isMe && (
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} className="p-1.5 hover:bg-white rounded-lg transition-all shadow-sm"><ZoomIn className="w-4 h-4 text-gray-600"/></button>
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-1.5 hover:bg-white rounded-lg transition-all shadow-sm"><ZoomOut className="w-4 h-4 text-gray-600"/></button>
                </div>
            )}
        </div>

        <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative bg-[#F8FAFC] cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={onContainerPointerDown}
            onPointerMove={onContainerPointerMove}
            onPointerUp={onContainerPointerUp}
            onWheel={handleWheel}
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
                <div className="inline-grid gap-[2px] bg-slate-300 p-[2px] rounded shadow-2xl"
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

        {player.status !== 'playing' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                {player.status === 'left' && <div className="bg-black/40 backdrop-blur-[1px] absolute inset-0" />}
                {player.status === 'won' && <div className="bg-emerald-500 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest shadow-xl animate-bounce flex items-center gap-2 z-40 transform -rotate-6 border-4 border-white"><Trophy className="w-6 h-6" /> WON</div>}
                {player.status === 'lost' && <div className="bg-red-600 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest shadow-xl animate-in zoom-in flex items-center gap-2 z-40 transform rotate-6 border-4 border-white"><Skull className="w-6 h-6" /> DEAD</div>}
                {player.status === 'left' && <div className="bg-gray-700 text-white px-4 py-2 rounded-2xl font-black uppercase tracking-widest shadow-xl animate-pulse flex items-center gap-2 z-40 border-4 border-white"><UserX className="w-6 h-6" /> LEFT</div>}
            </div>
        )}
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

  // Escape dismisses the results overlay (back to viewing the board)
  useEscape(showResults, () => setResultsDismissedFor(gameState.startTime));

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

  if (!me) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#9e1316]" /></div>;

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-30 mix-blend-overlay pointer-events-none" />

        <GameRulesModal
            isOpen={showRules}
            onClose={() => setShowRules(false)}
            rules={GAME_RULES[lang as 'ru' | 'en'].minesweeper}
            themeColor="text-red-600"
        />

        <GameHeader
            title="Minesweeper"
            icon={Bomb}
            timeLeft={timeLeft}
            showTime={true}
            onLeave={leaveGame}
            onShowRules={() => setShowRules(true)}
            lang={lang}
            accentColor="text-red-600"
       />

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
                <button onClick={() => setResultsDismissedFor(null)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold uppercase text-xs shadow-lg animate-in zoom-in hover:bg-emerald-700">
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
               />
            </div>
            {opponents.map(p => (
                <div key={p.id} className="relative opacity-90 hover:opacity-100 transition-opacity">
                    <BoardView player={p} isMe={false} onReveal={()=>{}} onFlag={()=>{}} onChord={()=>{}} scale={players.length > 2 ? 0.8 : 1} />
                </div>
            ))}
        </main>

        {showResults && (
            <div className="fixed inset-0 z-50 bg-[#1A1F26]/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white rounded-[40px] overflow-hidden shadow-2xl max-w-2xl w-full border border-[#E6E1DC] flex flex-col max-h-[85vh] animate-in zoom-in-95">
                    <div className="bg-[#1A1F26] p-8 text-white text-center relative shrink-0">
                        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
                        <h2 className="text-4xl font-black uppercase tracking-widest text-white mb-2 relative z-10">
                            {gameState.winner ? t.victory : t.defeat}
                        </h2>
                        {gameState.winner && <div className="text-[#FBBF24] font-bold flex justify-center gap-2 items-center text-sm uppercase tracking-wider relative z-10"><Trophy className="w-4 h-4"/> {gameState.winner}</div>}

                        <button onClick={() => setResultsDismissedFor(gameState.startTime)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20" title={t.viewBoard}>
                            <Eye className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    <div className="p-8 bg-[#F8FAFC] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-2xs font-black text-[#8A9099] uppercase tracking-widest border-b border-[#E6E1DC]">
                                    <th className="pb-4 pl-4">{t.player}</th>
                                    <th className="pb-4 text-center">{t.status}</th>
                                    <th className="pb-4 text-center">{t.timeStat}</th>
                                    <th className="pb-4 text-right pr-4">{t.progress}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E6E1DC]">
                                {getSortedPlayers().map((p, idx) => (
                                    <tr key={p.id} className={`group transition-colors hover:bg-white ${p.id === userId ? 'bg-white' : ''}`}>
                                        <td className="py-4 pl-4 font-bold text-[#1A1F26] flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden border border-gray-100"><Image src={p.avatarUrl} alt="" width={40} height={40} className="w-full h-full object-cover"/></div>
                                            <div>
                                                <div className="text-sm">{p.name}</div>
                                                {idx === 0 && gameState.winner && <div className="text-3xs text-[#FBBF24] font-black uppercase flex items-center gap-1"><Trophy className="w-3 h-3"/> Winner</div>}
                                            </div>
                                        </td>
                                        <td className="py-4 text-center">
                                            {p.status === 'won' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-2xs font-black uppercase tracking-wider">{t.won}</span>}
                                            {p.status === 'lost' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-2xs font-black uppercase tracking-wider">{t.dead}</span>}
                                            {p.status === 'left' && <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-2xs font-black uppercase tracking-wider">{t.left}</span>}
                                            {p.status === 'playing' && <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-2xs font-black uppercase tracking-wider">{t.alive}</span>}
                                        </td>
                                        <td className="py-4 text-center font-mono text-sm font-bold text-[#1A1F26]">
                                            {p.score ? `${Math.floor(p.score/60)}:${(p.score%60).toString().padStart(2,'0')}` : '—'}
                                        </td>
                                        <td className="py-4 text-right pr-4">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="font-black text-sm text-[#1A1F26]">{getProgress(p)}%</span>
                                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full ${p.status === 'lost' ? 'bg-red-500' : 'bg-[#1A1F26]'}`} style={{ width: `${getProgress(p)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-white border-t border-[#E6E1DC] flex flex-col items-center gap-3 shrink-0">
                        <RematchButton
                          gameId="minesweeper"
                          parentState={gameState}
                          lang={lang}
                          className="w-full max-w-sm py-4 border border-[#E6E1DC] text-[#1A1F26] rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#F8FAFC] transition-colors"
                        />
                        {/* leaveGame (handleLeave) awaits the DB write and navigates by itself */}
                        <button onClick={leaveGame} className="w-full max-w-sm py-4 bg-[#1A1F26] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-xl shadow-[#1A1F26]/10">
                            {t.leave}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}