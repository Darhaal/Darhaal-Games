'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Grid2x2 } from 'lucide-react';
import type { DotsPlayer, DotsState, Edge, EdgeOrientation } from '@/types/dots';
import { boxTally, hCount, vCount } from '@/lib/gameLogic/dots';
import { SEAT_COLORS } from '@/games/palette';
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
    youWin: 'Победа',
    draw: 'Ничья',
    winner: 'Победитель',
    thinking: 'обдумывает ход',
    boxes: (n: number) => pluralRu(n, ['квадрат', 'квадрата', 'квадратов']),
    hint: 'Нажмите на линию между точками. Закрыли квадрат — ходите ещё раз'
  },
  en: {
    youWin: 'You win',
    draw: 'Draw',
    winner: 'Winner',
    thinking: 'is thinking',
    boxes: (n: number) => pluralEn(n, 'box', 'boxes'),
    hint: 'Tap a line between two dots. Close a box and you go again'
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
            // 0x40 rather than 0x26: at fifteen percent the claimed box was
            // barely a tint, and telling apart who owns which half of the
            // board is the whole scoreboard.
            backgroundColor: color ? `${color}40` : undefined
          }}
          className="rounded-[2px] transition-colors"
        />
      );
    }
  }

  const last = gameState.lastEdge;

  /** One line: drawn in its owner's colour, or offered in yours. */
  const line = (orientation: EdgeOrientation, index: number, row: number, col: number) => {
    const owner = orientation === 'h' ? gameState.hLines[index] : gameState.vLines[index];
    const color = colorOfPlayer(owner);
    const open = !owner && isMyTurn;
    // The move just played, drawn heavier. Every line otherwise weighs the
    // same, so a move made while you were reading the other side of the grid
    // left nothing to find.
    const justPlayed = !!owner && last?.orientation === orientation && last.index === index;

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
            orientation === 'h'
              ? justPlayed ? 'h-[7px] w-[92%]' : 'h-[4px] w-[86%]'
              : justPlayed ? 'w-[7px] h-[92%]' : 'w-[4px] h-[86%]'
          } ${open ? 'bg-[#E6E1DC]' : ''}`}
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
  const iWon = gameState.winnerIds.includes(userId);
  const resultTitle = winners.length > 1 ? t.draw : iWon ? t.youWin : t.winner;
  const tokenOf = (p: DotsPlayer) => ({ color: SEAT_COLORS[p.seat % 4], seat: p.seat });

  return (
    <div className={GAME_PAGE}>
      <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />

      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        rules={GAME_RULES[lang].dots}
        themeColor="text-[#1A1F26]"
      />

      <GameHeader
        title={requireGame('dots').name[lang]}
        icon={Grid2x2}
        timeLeft={timeLeft}
        showTime={gameState.status === 'playing'}
        onLeave={leaveGame}
        onShowRules={() => setShowRules(true)}
        lang={lang}
      />

      <GameLayout
        board={
          // A white square with a hairline edge: the board, strict at the
          // corners like every other.
          <div className="bg-white border border-[#E6E1DC] p-[5%]">
            <div
              className="w-full grid aspect-square"
              style={{ gridTemplateColumns: track, gridTemplateRows: track }}
            >
              {cells}
            </div>
          </div>
        }
        side={
          <>
            <TurnCard
              lang={lang}
              who={turnPlayer ? { name: turnPlayer.name, isMe: turnPlayer.id === userId, ...tokenOf(turnPlayer) } : null}
              hint={isMyTurn ? t.hint : turnPlayer ? t.thinking : undefined}
              secondsLeft={gameState.status === 'playing' ? timeLeft : undefined}
              turnSeconds={gameState.settings.turnDuration}
              result={isFinished ? {
                won: iWon,
                title: resultTitle,
                detail: winners.map((w) => `${w.name} — ${tally[w.id] || 0}`).join(' · '),
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
                    {tally[p.id] || 0} <span className="font-medium">{t.boxes(tally[p.id] || 0)}</span>
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
        note={winners.map((w) => `${w.name} — ${tally[w.id] || 0} ${t.boxes(tally[w.id] || 0)}`).join(' · ')}
        winners={winners.map((w) => ({ id: w.id, name: w.name, token: tokenOf(w) }))}
        gameId="dots"
        parentState={gameState}
        onMenu={leaveGame}
      />
    </div>
  );
}

/** Exported for the tests that assert the board renders every line once. */
export const edgeTotals = (size: number) => hCount(size) + vCount(size);
