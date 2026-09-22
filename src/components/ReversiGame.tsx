'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { CircleDot, Crown } from 'lucide-react';
import type { ReversiPlayer, ReversiState } from '@/types/reversi';
import { legalMoves, tally } from '@/lib/gameLogic/reversi';
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

interface ReversiGameProps {
  gameState: ReversiState;
  userId: string;
  placeDisc: (index: number) => void;
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
    discs: (n: number) => pluralRu(n, ['фишка', 'фишки', 'фишек']),
    hint: 'Нажмите на подсвеченную клетку',
    passed: 'Ход пропущен — ставить некуда'
  },
  en: {
    yourTurn: 'Your turn',
    waitingFor: 'Now playing',
    youWin: 'You win',
    draw: 'Draw',
    winner: 'Winner',
    toMenu: 'Main menu',
    discs: (n: number) => pluralEn(n, 'disc', 'discs'),
    hint: 'Tap a highlighted square',
    passed: 'Turn passed — nowhere to play'
  }
};

export default function ReversiGame({
  gameState, userId, placeDisc, handleTimeout, leaveGame, lang
}: ReversiGameProps) {
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

  /** Only the squares that actually trap something are offered. */
  const myMoves = useMemo(() => {
    if (!isMyTurn || !me) return new Set<number>();
    return new Set(legalMoves(gameState.board, size, me.seat));
  }, [isMyTurn, me, gameState.board, size]);

  const counts = tally(gameState.board);
  const winners = gameState.players.filter((p) => gameState.winnerIds.includes(p.id));

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1F26] flex flex-col">
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].reversi}
        themeColor="text-[#334155]"
      />

      <GameHeader
        title="Reversi"
        icon={CircleDot}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
        accentColor="text-[#334155]"
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-8">
        <section className="flex-1 flex flex-col items-center min-w-0">
          <div
            className="w-full max-w-[min(92vw,520px)] grid gap-[2px] p-[2px] bg-[#D9D6CE] rounded-lg aspect-square"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {gameState.board.map((seat, index) => {
              const playable = myMoves.has(index);

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!playable}
                  onClick={() => playable && placeDisc(index)}
                  className={`relative aspect-square bg-[#EFEDE7] transition-colors ${
                    playable ? 'cursor-pointer hover:bg-[#E4E1D8]' : ''
                  }`}
                  aria-label={`${(index % size) + 1},${Math.floor(index / size) + 1}`}
                >
                  {seat != null && (
                    <PlayerToken
                      className="absolute inset-[10%]"
                      color={SEAT_COLORS[seat % 4]}
                      seat={seat}
                    />
                  )}

                  {/* Where you may play, in your own colour. */}
                  {playable && seat == null && (
                    <span
                      className="absolute inset-0 m-auto w-[26%] h-[26%] rounded-full opacity-60"
                      style={{ backgroundColor: myColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <PlayerLegend
            className="mt-5"
            players={orderedPlayers}
            currentUserId={userId}
            colorOf={(seat) => SEAT_COLORS[seat % 4]}
          />

          <p className="mt-3 text-sm font-medium text-[#8A9099]">
            {isMyTurn
              ? myMoves.size > 0 ? t.hint : t.passed
              : turnPlayer ? `${t.waitingFor}: ${turnPlayer.name}` : ''}
          </p>
        </section>

        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="text-base font-bold text-center lg:text-left">
            {isFinished
              ? t.winner
              : isMyTurn
                ? <span style={{ color: myColor }}>{t.yourTurn}</span>
                : <span className="text-[#8A9099]">{turnPlayer ? `${t.waitingFor}: ${turnPlayer.name}` : ''}</span>}
          </div>

          <div className="space-y-1">
            {orderedPlayers.map((p: ReversiPlayer) => {
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
                      <span className="text-sm font-bold truncate">{p.name}</span>
                      {p.isHost && <Crown className="w-3 h-3 text-amber-500 fill-current shrink-0" />}
                    </div>
                    <div className="text-xs font-bold text-[#8A9099] mt-0.5">
                      {counts[p.seat] || 0} <span className="font-medium">{t.discs(counts[p.seat] || 0)}</span>
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
              {winners.map((w) => `${w.name} — ${counts[w.seat] || 0}`).join(' · ')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={leaveGame}
                className="flex-1 py-3 border border-[#E6E1DC] rounded-xl font-bold uppercase text-xs hover:bg-[#F8FAFC] transition-colors"
              >
                {t.toMenu}
              </button>
              <RematchButton
                gameId="reversi"
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
