'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { CircleDot } from 'lucide-react';
import type { ReversiPlayer, ReversiState } from '@/types/reversi';
import { legalMoves, tally } from '@/lib/gameLogic/reversi';
import { SEAT_COLORS } from '@/games/palette';
import PlayerToken from './PlayerToken';
import GameHeader from './GameHeader';
import { requireGame } from '@/games/registry';
import GameNotificationToast from './GameNotificationToast';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import GameLayout from './game/GameLayout';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { GAME_PAGE } from './game/ui';
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
    youWin: 'Победа',
    draw: 'Ничья',
    winner: 'Победитель',
    thinking: 'обдумывает ход',
    discs: (n: number) => pluralRu(n, ['фишка', 'фишки', 'фишек']),
    hint: 'Нажмите на подсвеченную клетку',
    passed: 'Ход пропущен — ставить некуда'
  },
  en: {
    youWin: 'You win',
    draw: 'Draw',
    winner: 'Winner',
    thinking: 'is thinking',
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
  // The result can be put aside to look at the final board, and brought back.
  const [resultHidden, setResultHidden] = useState(false);

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
  const iWon = gameState.winnerIds.includes(userId);
  const resultTitle = winners.length > 1 ? t.draw : iWon ? t.youWin : t.winner;
  const tokenOf = (p: ReversiPlayer) => ({ color: SEAT_COLORS[p.seat % 4], seat: p.seat });

  // Grid and outer line as in every board: white squares on the site's grey.
  const GAP = '2.5%';

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].reversi}
        themeColor="text-[#1A1F26]"
      />

      <GameHeader
        title={requireGame('reversi').name[lang]}
        icon={CircleDot}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
      />

      <GameLayout
        board={
          <div
            className="w-full grid aspect-square bg-[#E6E1DC]"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: `calc(${GAP} / ${size})`, padding: `calc(${GAP} / ${size})` }}
          >
            {gameState.board.map((seat, index) => {
              const playable = myMoves.has(index);
              const isLast = gameState.lastMove === index;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!playable}
                  onClick={() => playable && placeDisc(index)}
                  style={playable ? { backgroundColor: `color-mix(in srgb, ${myColor} 14%, white)` } : undefined}
                  className={`relative aspect-square bg-white transition-[filter] ${
                    playable ? 'cursor-pointer hover:brightness-95' : ''
                  }`}
                  aria-label={`${(index % size) + 1},${Math.floor(index / size) + 1}`}
                >
                  {seat != null && (
                    <PlayerToken
                      className="absolute inset-[12%]"
                      color={SEAT_COLORS[seat % 4]}
                      seat={seat}
                    />
                  )}

                  {/* The disc just placed, ringed so it can be found. */}
                  {isLast && seat != null && (
                    <span aria-hidden className="absolute inset-[6%] rounded-full border-2 border-[#1A1F26]" />
                  )}

                  {/* Where you may play, in your own colour. */}
                  {playable && seat == null && (
                    <span
                      className="absolute inset-0 m-auto w-[30%] h-[30%] rounded-full opacity-70"
                      style={{ backgroundColor: myColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        }
        side={
          <>
            <TurnCard
              lang={lang}
              who={turnPlayer ? { name: turnPlayer.name, isMe: turnPlayer.id === userId, ...tokenOf(turnPlayer) } : null}
              hint={isMyTurn ? (myMoves.size > 0 ? t.hint : t.passed) : turnPlayer ? t.thinking : undefined}
              secondsLeft={gameState.status === 'playing' ? timeLeft : undefined}
              turnSeconds={gameState.settings.turnDuration}
              result={isFinished ? {
                won: iWon,
                title: resultTitle,
                detail: winners.map((w) => `${w.name} — ${counts[w.seat] || 0}`).join(' · '),
                hidden: resultHidden,
                onShow: () => setResultHidden(false)
              } : undefined}
            />

            <PlayersCard
              lang={lang}
              rows={orderedPlayers.map((p) => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.avatarUrl,
                isHost: p.isHost,
                isMe: p.id === userId,
                token: tokenOf(p),
                active: !isFinished && p.id === gameState.turnPlayerId,
                won: isFinished && gameState.winnerIds.includes(p.id),
                stat: (
                  <span className="tabular-nums">
                    {counts[p.seat] || 0} <span className="font-medium">{t.discs(counts[p.seat] || 0)}</span>
                  </span>
                )
              }))}
            />
          </>
        }
      />

      <ResultDialog
        lang={lang}
        open={isFinished && !resultHidden}
        onHide={() => setResultHidden(true)}
        won={iWon}
        title={resultTitle}
        note={winners.map((w) => `${w.name} — ${counts[w.seat] || 0} ${t.discs(counts[w.seat] || 0)}`).join(' · ')}
        winners={winners.map((w) => ({ id: w.id, name: w.name, token: tokenOf(w) }))}
        gameId="reversi"
        parentState={gameState}
        onMenu={leaveGame}
      />
    </div>
  );
}
