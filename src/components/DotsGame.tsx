'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { Crown, Grid2x2, Trophy } from 'lucide-react';
import type { DotsPlayer, DotsState, Edge, EdgeOrientation } from '@/types/dots';
import { boxTally, hCount, vCount } from '@/lib/gameLogic/dots';
import { SEAT_COLORS } from '@/games/palette';
import PlayerToken, { PlayerLegend } from './PlayerToken';
import RematchButton from './RematchButton';
import GameHeader from './GameHeader';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { defaultAvatar } from '@/constants/app';
import { playSfx } from '@/lib/sound';
import { pluralEn, pluralRu } from '@/lib/plural';

interface DotsGameProps {
  gameState: DotsState;
  userId: string;
  drawLine: (edge: Edge) => void;
  handleTimeout: () => void;
  leaveGame: () => void;
  lang: 'ru' | 'en';
}

const UI_TEXT = {
  ru: {
    yourTurn: 'Ваш ход',
    waitingFor: 'Ходит',
    youWin: 'Победа',
    draw: 'Ничья',
    winner: 'Победитель',
    toMenu: 'В меню',
    boxes: (n: number) => pluralRu(n, ['квадрат', 'квадрата', 'квадратов']),
    hint: 'Нажмите на линию между точками'
  },
  en: {
    yourTurn: 'Your turn',
    waitingFor: 'Now playing',
    youWin: 'You win',
    draw: 'Draw',
    winner: 'Winner',
    toMenu: 'Main menu',
    boxes: (n: number) => pluralEn(n, 'box', 'boxes'),
    hint: 'Tap a line between two dots'
  }
};

/** Dot diameter as a fraction of a box, so the grid scales as one piece. */
const DOT_FR = 0.26;

export default function DotsGame({
  gameState, userId, drawLine, handleTimeout, leaveGame, lang
}: DotsGameProps) {
  const t = UI_TEXT[lang];
  const [showRules, setShowRules] = useState(false);
  const [timeLeft, setTimeLeft] = useState(gameState.settings.turnDuration);

  const size = gameState.size;
  const me = gameState.players.find((p) => p.id === userId);
  const isMyTurn = gameState.status === 'playing' && gameState.turnPlayerId === userId;
  const turnPlayer = gameState.players.find((p) => p.id === gameState.turnPlayerId);
  const isFinished = gameState.status === 'finished';
  const myColor = me ? SEAT_COLORS[me.seat % 4] : SEAT_COLORS[0];
  const orderedPlayers = useMemo(
    () => [...gameState.players].sort((a, b) => a.seat - b.seat),
    [gameState.players]
  );

  const colorOfPlayer = (id: string | null): string | undefined => {
    const owner = id ? gameState.players.find((p) => p.id === id) : undefined;
    return owner ? SEAT_COLORS[owner.seat % 4] : undefined;
  };

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

  const tally = boxTally(gameState);

  // Tracks alternate dot, gap, dot, gap … so a line and the dots it joins sit
  // in the same grid rather than being positioned against each other.
  const track = `repeat(${size}, ${DOT_FR}fr 1fr) ${DOT_FR}fr`;
  const cells: React.ReactNode[] = [];

  // Closed boxes, painted under everything else.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const owner = gameState.boxes[row * size + col];
      const color = colorOfPlayer(owner);

      cells.push(
        <span
          key={`b${row},${col}`}
          aria-hidden
          style={{
            gridColumn: 2 * col + 2,
            gridRow: 2 * row + 2,
            backgroundColor: color ? `${color}26` : undefined
          }}
          className="rounded-[2px] transition-colors"
        />
      );
    }
  }

  /** One line: drawn in its owner's colour, or offered in yours. */
  const line = (orientation: EdgeOrientation, index: number, row: number, col: number) => {
    const owner = orientation === 'h' ? gameState.hLines[index] : gameState.vLines[index];
    const color = colorOfPlayer(owner);
    const open = !owner && isMyTurn;

    return (
      <button
        key={`${orientation}${index}`}
        type="button"
        disabled={!open}
        onClick={() => open && drawLine({ orientation, index })}
        style={
          orientation === 'h'
            ? { gridColumn: 2 * col + 2, gridRow: 2 * row + 1 }
            : { gridColumn: 2 * col + 1, gridRow: 2 * row + 2 }
        }
        className={`group relative flex items-center justify-center ${
          open ? 'cursor-pointer' : 'pointer-events-none'
        }`}
        aria-label={owner ? 'line' : 'open line'}
      >
        {/* Reaches into the neighbouring squares so the thin line is still a
            target on a phone. Nothing else on this board is tappable, so
            there is nothing for it to steal. */}
        {open && (
          <span className={`absolute ${orientation === 'h' ? '-inset-y-2 inset-x-0' : '-inset-x-2 inset-y-0'}`} />
        )}

        <span
          className={`rounded-full transition-all ${
            orientation === 'h' ? 'h-[4px] w-[86%]' : 'w-[4px] h-[86%]'
          } ${open ? 'bg-[#E0DDD6] group-hover:opacity-100' : ''}`}
          style={color ? { backgroundColor: color } : open ? { } : { backgroundColor: 'transparent' }}
        />

        {/* The line you would draw, previewed in your own colour. */}
        {open && (
          <span
            className={`absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
              orientation === 'h' ? 'h-[4px] w-[86%]' : 'w-[4px] h-[86%]'
            }`}
            style={{ backgroundColor: myColor }}
          />
        )}
      </button>
    );
  };

  for (let row = 0; row <= size; row++) {
    for (let col = 0; col < size; col++) cells.push(line('h', row * size + col, row, col));
  }
  for (let row = 0; row < size; row++) {
    for (let col = 0; col <= size; col++) cells.push(line('v', row * (size + 1) + col, row, col));
  }

  // The dots themselves, on top of the lines that meet at them.
  for (let row = 0; row <= size; row++) {
    for (let col = 0; col <= size; col++) {
      cells.push(
        <span
          key={`d${row},${col}`}
          aria-hidden
          style={{ gridColumn: 2 * col + 1, gridRow: 2 * row + 1 }}
          className="rounded-full bg-[#1A1F26] pointer-events-none"
        />
      );
    }
  }

  const winners = gameState.players.filter((p) => gameState.winnerIds.includes(p.id));

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1F26] flex flex-col">
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].dots}
        themeColor="text-[#0d9488]"
      />

      <GameHeader
        title="Dots & Boxes"
        icon={Grid2x2}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
        accentColor="text-[#0d9488]"
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-8">
        <section className="flex-1 flex flex-col items-center min-w-0">
          <div
            className="w-full max-w-[min(92vw,540px)] grid aspect-square"
            style={{ gridTemplateColumns: track, gridTemplateRows: track }}
          >
            {cells}
          </div>

          <PlayerLegend
            className="mt-5"
            players={orderedPlayers}
            currentUserId={userId}
            colorOf={(seat) => SEAT_COLORS[seat % 4]}
          />

          <p className="mt-2 text-[11px] font-medium text-[#8A9099]">
            {isMyTurn ? t.hint : turnPlayer ? `${t.waitingFor}: ${turnPlayer.name}` : ''}
          </p>
        </section>

        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="text-sm font-bold text-center lg:text-left">
            {isFinished
              ? t.winner
              : isMyTurn
                ? <span style={{ color: myColor }}>{t.yourTurn}</span>
                : <span className="text-[#8A9099]">{turnPlayer ? `${t.waitingFor}: ${turnPlayer.name}` : ''}</span>}
          </div>

          <div className="space-y-1">
            {orderedPlayers.map((p: DotsPlayer) => {
              const active = p.id === gameState.turnPlayerId;
              const color = SEAT_COLORS[p.seat % 4];

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
                    <PlayerToken
                      className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ring-2 ring-white"
                      color={color}
                      seat={p.seat}
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-[#8A9099] mt-0.5">
                      <Trophy className="w-3 h-3" />
                      {tally[p.id] || 0} <span className="font-medium">{t.boxes(tally[p.id] || 0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>

      {isFinished && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs border border-[#E6E1DC] shadow-xl p-6 text-center animate-in zoom-in-95">
            <h3 className="text-lg font-black uppercase tracking-wide mb-1">
              {winners.length > 1 ? t.draw : gameState.winnerIds.includes(userId) ? t.youWin : t.winner}
            </h3>
            <p className="text-sm font-medium text-[#8A9099] mb-6">
              {winners.map((w) => `${w.name} — ${tally[w.id] || 0}`).join(' · ')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={leaveGame}
                className="flex-1 py-3 border border-[#E6E1DC] rounded-xl font-bold uppercase text-[11px] hover:bg-[#F8FAFC] transition-colors"
              >
                {t.toMenu}
              </button>
              <RematchButton
                gameId="dots"
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

/** Exported for the tests that assert the board renders every line once. */
export const edgeTotals = (size: number) => hCount(size) + vCount(size);
