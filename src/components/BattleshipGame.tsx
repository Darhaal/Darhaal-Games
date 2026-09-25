'use client';

import React, { useState, useEffect, memo } from 'react';
import { RotateCw, Trash2, Check, Shuffle, Anchor, Crosshair, Shield } from 'lucide-react';
import { Ship, ShipType, FLEET_CONFIG, Orientation, Coordinate, CellStatus, BattleshipState } from '@/types/battleship';
import { checkPlacement } from '@/lib/gameLogic/battleship';
import GameHeader from './GameHeader';
import GameNotificationToast from './GameNotificationToast';
import { requireGame } from '@/games/registry';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import GameLayout from './game/GameLayout';
import GameCard from './game/GameCard';
import TurnCard from './game/TurnCard';
import PlayersCard from './game/PlayersCard';
import ResultDialog from './game/ResultDialog';
import { BUTTON_DANGER_QUIET, BUTTON_PRIMARY, BUTTON_SECONDARY, GAME_PAGE, LABEL } from './game/ui';
import { pluralEn, pluralRu } from '@/lib/plural';
import { playSfx } from '@/lib/sound';
import { useGameKeys } from '@/hooks/useGameKeys';
import { isRotate } from '@/lib/keys';

const CELL_SIZE_L = "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10";
const CELL_SIZE_S = "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6";

const DICTIONARY = {
    ru: {
        fleet: 'Верфь',
        auto: 'Авто',
        ready: 'Готов',
        waiting: 'Ожидание…',
        readyStatus: 'готов к бою',
        placingStatus: 'расставляет флот…',
        waitingOpponent: 'ждём соперника…',
        victory: 'Победа',
        defeat: 'Поражение',
        winMsg: 'Вражеский флот уничтожен',
        loseMsg: 'Наш флот пошёл ко дну',
        surrenderMsg: 'Противник покинул бой',
        zoneEnemy: 'Радар',
        zoneMe: 'Мой флот',
        enemy: 'Противник',
        clear: 'Сброс',
        horizontal: 'Горизонтально',
        vertical: 'Вертикально',
        stats: 'Состояние флота',
        fireHint: 'Стреляйте по радару. Попали — стреляете ещё раз',
        thinking: 'выбирает цель',
        setupHint: 'Выберите корабль и нажмите на клетку, или перетащите его на поле. R или пробел — повернуть.',
        afloat: (n: number) => `${n} ${pluralRu(n, ['корабль', 'корабля', 'кораблей'])} на плаву`,
        ships: { battleship: 'Линкор', cruiser: 'Крейсер', destroyer: 'Эсминец', submarine: 'Подлодка' } as Record<ShipType, string>
    },
    en: {
        fleet: 'Shipyard',
        auto: 'Auto',
        ready: 'Ready',
        waiting: 'Waiting…',
        readyStatus: 'ready for battle',
        placingStatus: 'placing the fleet…',
        waitingOpponent: 'waiting for an opponent…',
        victory: 'Victory',
        defeat: 'Defeat',
        winMsg: 'The enemy fleet is destroyed',
        loseMsg: 'Our fleet has sunk',
        surrenderMsg: 'The opponent left the battle',
        zoneEnemy: 'Radar',
        zoneMe: 'My fleet',
        enemy: 'Enemy',
        clear: 'Reset',
        horizontal: 'Horizontal',
        vertical: 'Vertical',
        stats: 'Fleet status',
        fireHint: 'Fire at the radar. A hit and you fire again',
        thinking: 'is choosing a target',
        setupHint: 'Pick a ship and tap a square, or drag it onto the board. R or Space turns it.',
        afloat: (n: number) => `${n} ${pluralEn(n, 'ship', 'ships')} afloat`,
        ships: { battleship: 'Battleship', cruiser: 'Cruiser', destroyer: 'Destroyer', submarine: 'Submarine' } as Record<ShipType, string>
    }
};

const getShipColor = (type: ShipType) => {
    switch (type) {
        case 'battleship': return 'bg-[#1A1F26]';
        case 'cruiser': return 'bg-[#4B5563]';
        case 'destroyer': return 'bg-[#6B7280]';
        case 'submarine': return 'bg-[#9CA3AF]';
    }
};

interface GridCellProps {
    status: CellStatus | 'empty';
    shipPart?: ShipType;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    isHovered?: boolean;
    hoverValid?: boolean;
    size?: 'large' | 'small';
}

const GridCell = memo(({
    status, shipPart, onClick, onMouseEnter, onContextMenu,
    onDrop, onDragOver, onDragStart, isHovered, hoverValid, size = 'large'
}: GridCellProps) => {
    const isSmall = size === 'small';
    let content = null;

    let bgClass = "bg-white";
    let borderClass = "";

    if (status === 'miss') {
        content = <div className={`${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-[#8A9099]/40`} />;
    } else if (status === 'hit') {
        bgClass = "bg-red-50";
        content = <span className={`${isSmall ? 'text-2xs' : 'text-xl'} text-[#9e1316] font-black leading-none`}>✕</span>;
    } else if (status === 'killed') {
        bgClass = "bg-[#1A1F26]";
        content = <span className={`${isSmall ? 'text-[8px]' : 'text-sm'} text-white font-bold`}>☠</span>;
    } else if (shipPart) {
        if (status === 'empty') {
            bgClass = getShipColor(shipPart) + " shadow-sm border-white/20";
            borderClass = "border-transparent";
        }
    }

    if (isHovered) {
        bgClass = hoverValid
            ? "bg-emerald-500/30 ring-2 ring-emerald-500 inset z-10"
            : "bg-red-500/30 ring-2 ring-red-500 inset z-10";
    }

    const cursorClass = onClick && status === 'empty' ? 'cursor-crosshair' : 'cursor-default';
    const draggable = !!shipPart && !isSmall && status === 'empty';

    return (
        <div
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onContextMenu={onContextMenu}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragStart={draggable ? onDragStart : undefined}
            draggable={draggable}
            className={`
                ${isSmall ? CELL_SIZE_S : CELL_SIZE_L}
                ${borderClass}
                ${bgClass}
                ${cursorClass}
                flex items-center justify-center transition-all duration-150 select-none relative
                ${draggable ? 'cursor-grab active:cursor-grabbing hover:brightness-110' : ''}
            `}
        >
            {content}
        </div>
    );
});
GridCell.displayName = 'GridCell';

const FleetStatusList = ({ ships, isEnemy = false, names }: { ships: Ship[], isEnemy?: boolean, names: Record<ShipType, string> }) => {
    const groups = FLEET_CONFIG.map(config => {
        const typeShips = ships.filter(s => s.type === config.type);
        return { ...config, ships: typeShips };
    });

    return (
        <div className="space-y-3">
            {groups.map(g => (
                <div key={g.type} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isEnemy ? 'bg-[#9e1316]' : 'bg-[#1A1F26]'}`} />
                        <span className="font-bold text-[#8A9099] w-20 truncate">{names[g.type]}</span>
                    </div>

                    <div className="flex gap-1">
                        {g.ships.map((s, i) => {
                            const isDead = s.hits >= s.size;
                            const hpPercent = isDead ? 100 : Math.max(0, (s.size - s.hits) / s.size) * 100;

                            if (isEnemy) {
                                return (
                                    <div key={i} className={`w-8 h-2 rounded-sm border ${isDead ? 'bg-[#9e1316]/20 border-[#9e1316]' : 'bg-[#F5F5F0] border-[#E6E1DC]'}`}>
                                        {isDead && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-[#9e1316] font-bold">✕</div>}
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={i} className={`w-8 h-2 rounded-sm border border-[#E6E1DC] overflow-hidden relative ${isDead ? 'bg-[#9e1316]' : 'bg-[#F5F5F0]'}`}>
                                        {!isDead && (
                                            <div
                                                className={`absolute top-0 left-0 h-full transition-all duration-500 ${hpPercent < 50 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                                                style={{ width: `${hpPercent}%` }}
                                            />
                                        )}
                                        {isDead && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">☠</div>}
                                    </div>
                                );
                            }
                        })}
                        {Array.from({ length: Math.max(0, g.count - g.ships.length) }).map((_, i) => (
                             <div key={`ph-${i}`} className="w-8 h-2 rounded-sm bg-gray-100 border border-dashed border-gray-300" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

interface BattleshipGameProps {
    gameState: BattleshipState;
    userId: string;
    myShips: Ship[];
    autoPlaceShips: () => void;
    clearShips: () => void;
    placeShipManual: (ship: Ship) => boolean;
    removeShip: (id: string) => void;
    submitShips: () => void;
    fireShot: (x: number, y: number) => void;
    leaveGame: () => void;
    handleTimeout: () => void;
    lang: 'ru' | 'en';
}

export default function BattleshipGame({
    gameState, userId, myShips, autoPlaceShips, clearShips,
    placeShipManual, removeShip, submitShips, fireShot, leaveGame, handleTimeout, lang
}: BattleshipGameProps) {
    const [orientation, setOrientation] = useState<Orientation>('horizontal');
    const [selectedType, setSelectedType] = useState<ShipType | null>(null);
    const [hoverPos, setHoverPos] = useState<Coordinate | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);
    const [movingShipId, setMovingShipId] = useState<string | null>(null);
    const [showRules, setShowRules] = useState(false);
    // The result can be put aside to look at the final board, and brought back.
    const [resultHidden, setResultHidden] = useState(false);

    const t = DICTIONARY[lang] || DICTIONARY['ru'];
    const me = userId ? gameState.players[userId] : null;
    const opponentId = Object.keys(gameState.players).find(id => id !== userId);
    const opponent = opponentId ? gameState.players[opponentId] : null;
    const isMyTurn = gameState.turn === userId;
    const phase = gameState.phase;

    useEffect(() => {
        if (phase !== 'playing') return;
        const interval = setInterval(() => {
            // Server-authoritative turn deadline; lastActionTime fallback for legacy states
            const deadline = gameState.turnDeadline || ((gameState.lastActionTime || Date.now()) + 60000);
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setTimeLeft(remaining);
            // The player on turn is the primary writer; the opponent backs up
            // five seconds later, which is what rescues the match when the
            // player on turn has disconnected rather than merely stalled.
            if (remaining === 0 && (isMyTurn || Date.now() - deadline > 5000)) handleTimeout();
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState.turnDeadline, gameState.lastActionTime, phase, isMyTurn, handleTimeout]);

    // Match outcome sound
    useEffect(() => {
        if (phase === 'finished') playSfx(gameState.winner === userId ? 'win' : 'lose');
    }, [phase, gameState.winner, userId]);

    // Keyboard: R, Q, E or Space rotates the ship being placed. Setup only, so
    // it does not swallow Space/scroll during the battle, and never while
    // typing in the chat.
    useGameKeys(phase === 'setup', (e) => {
        if (!isRotate(e)) return;
        setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
        return true;
    });

    const getMyCellContent = (x: number, y: number) => {
        const s = myShips.find((s: Ship) => {
            if (movingShipId === s.id) return false;
            if (s.orientation === 'horizontal') return s.position.y === y && x >= s.position.x && x < s.position.x + s.size;
            return s.position.x === x && y >= s.position.y && y < s.position.y + s.size;
        });
        const shot = phase === 'playing' && opponent?.shots ? opponent.shots[`${x},${y}`] : null;
        return { status: (shot || 'empty') as CellStatus | 'empty', shipPart: s?.type, ship: s };
    };

    const getOpponentCellContent = (x: number, y: number) => {
        const shot = me?.shots[`${x},${y}`];
        return { status: (shot || 'empty') as CellStatus | 'empty' };
    };

    const isPlacementValid = (() => {
        if (!selectedType || !hoverPos) return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedType);
        if (!config) return false;
        return checkPlacement(
            myShips,
            {
                id: 'temp',
                type: selectedType,
                size: config.size,
                orientation,
                position: hoverPos,
                hits: 0
            },
            movingShipId || undefined
        );
    })();

    const tryPlaceShip = (x: number, y: number, type: ShipType, existingId?: string) => {
        const config = FLEET_CONFIG.find(c => c.type === type);
        if (!config) return;
        if (!existingId) {
            const count = myShips.filter((s: Ship) => s.type === type).length;
            if (count >= config.count) return;
        }
        const newShip: Ship = {
            id: existingId || `${type}-${Date.now()}`,
            type, size: config.size, orientation, position: { x, y }, hits: 0
        };
        if (placeShipManual(newShip)) {
            if (!existingId) {
                const newCount = myShips.filter((s: Ship) => s.type === type).length + 1;
                if (newCount >= config.count) setSelectedType(null);
            }
            setMovingShipId(null);
        }
    };

    const handleCellClick = (x: number, y: number) => {
        if (selectedType) tryPlaceShip(x, y, selectedType);
        else {
            const { ship } = getMyCellContent(x, y);
            if (ship) {
                removeShip(ship.id);
                setSelectedType(ship.type);
                setOrientation(ship.orientation);
                setHoverPos({ x, y });
            }
        }
    };

    const handleDragStartMenu = (e: React.DragEvent, type: ShipType) => {
        if (typeof window !== 'undefined') e.dataTransfer.setDragImage(new window.Image(), 0, 0);
        setSelectedType(type);
        e.dataTransfer.setData('type', type);
    };
    const handleDragStartBoard = (e: React.DragEvent, ship: Ship) => {
        if (typeof window !== 'undefined') e.dataTransfer.setDragImage(new window.Image(), 0, 0);
        setMovingShipId(ship.id);
        setOrientation(ship.orientation);
        e.dataTransfer.setData('type', ship.type);
        e.dataTransfer.setData('id', ship.id);
    };
    const handleDrop = (e: React.DragEvent, x: number, y: number) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type') as ShipType;
        const id = e.dataTransfer.getData('id');
        if (type) tryPlaceShip(x, y, type, id || undefined);
        setMovingShipId(null);
    };

    const isPhantomCell = (x: number, y: number) => {
        if (!hoverPos || !selectedType) return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedType)!;
        if (orientation === 'horizontal') return y === hoverPos.y && x >= hoverPos.x && x < hoverPos.x + config.size;
        else return x === hoverPos.x && y >= hoverPos.y && y < hoverPos.y + config.size;
    };

    const isFinished = phase === 'finished';
    const iWon = gameState.winner === userId;
    // A win with enemy ships still afloat means the other side left.
    const byForfeit = iWon && opponent?.aliveShipsCount !== 0;
    const resultTitle = iWon ? t.victory : t.defeat;
    const resultNote = byForfeit ? t.surrenderMsg : iWon ? t.winMsg : t.loseMsg;
    const turnHolder = isMyTurn ? me : opponent;
    const winnerPlayer = iWon ? me : opponent;

    const statusLine = (ready?: boolean, present = true) => (
        <span className={ready ? 'text-emerald-600' : ''}>
            {!present ? t.waitingOpponent : ready ? t.readyStatus : t.placingStatus}
        </span>
    );

    /** The grid, in the board style every game shares: white squares on grey. */
    const gridClass = 'grid grid-cols-10 gap-px bg-[#E6E1DC] p-px w-fit mx-auto';

    const radar = (
        <div>
            <div className={`${LABEL} mb-3 flex items-center justify-center gap-2`}>
                <Crosshair className="w-3.5 h-3.5" /> {t.zoneEnemy}
            </div>
            <div className={`${gridClass} ${isMyTurn && !isFinished ? 'cursor-crosshair' : ''}`}>
                {Array.from({ length: 100 }).map((_, i) => {
                    const x = i % 10, y = Math.floor(i / 10);
                    const { status } = getOpponentCellContent(x, y);
                    return (
                        <GridCell
                            key={i}
                            status={status}
                            onClick={isMyTurn && !isFinished && status === 'empty' ? () => fireShot(x, y) : undefined}
                        />
                    );
                })}
            </div>
        </div>
    );

    const shipName = (type: ShipType) => t.ships[type];

    return (
        <div className={GAME_PAGE}>
            <GameNotificationToast notifications={gameState.notifications || []} lang={lang} />
            <GameHeader
                title={requireGame('battleship').name[lang]}
                icon={Anchor}
                timeLeft={timeLeft}
                showTime={phase === 'playing'}
                onLeave={leaveGame}
                onShowRules={() => setShowRules(true)}
                lang={lang}
            />

            <GameRulesModal
                isOpen={showRules}
                onClose={() => setShowRules(false)}
                rules={GAME_RULES[lang as 'ru' | 'en'].battleship}
            />

            {phase === 'setup' && (
                <GameLayout
                    board={
                        <div>
                            <div className={`${LABEL} mb-3 flex items-center justify-center gap-2`}>
                                <Shield className="w-3.5 h-3.5" /> {t.zoneMe}
                            </div>
                            <div className={`${gridClass} cursor-crosshair`} onMouseLeave={() => setHoverPos(null)}>
                                {Array.from({ length: 100 }).map((_, i) => {
                                    const x = i % 10, y = Math.floor(i / 10);
                                    const { shipPart, ship } = getMyCellContent(x, y);
                                    const isHovered = isPhantomCell(x, y);
                                    const isValid = isHovered ? isPlacementValid : false;

                                    return <GridCell key={i} status={'empty'} shipPart={shipPart} onClick={() => handleCellClick(x, y)} onMouseEnter={() => setHoverPos({x, y})} onDrop={(e) => handleDrop(e, x, y)} onDragOver={(e) => {e.preventDefault(); setHoverPos({x, y})}} onDragStart={(e) => ship && handleDragStartBoard(e, ship)} onContextMenu={(e) => {e.preventDefault(); setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}} isHovered={isHovered} hoverValid={isValid} />;
                                })}
                            </div>
                        </div>
                    }
                    side={
                        <>
                            <GameCard label={t.fleet}>
                                <div className="space-y-2">
                                    {FLEET_CONFIG.map(ship => {
                                        const placedCount = myShips.filter((s: Ship) => s.type === ship.type).length;
                                        const isFull = placedCount >= ship.count;
                                        const isSelected = selectedType === ship.type;
                                        return (
                                            <button
                                                key={ship.type}
                                                type="button"
                                                draggable={!isFull}
                                                onDragStart={(e) => handleDragStartMenu(e, ship.type)}
                                                onClick={() => !isFull && setSelectedType(ship.type)}
                                                disabled={isFull}
                                                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                                                    isSelected
                                                        ? 'bg-[#1A1F26] text-white border-[#1A1F26]'
                                                        : isFull
                                                            ? 'bg-[#F8FAFC] border-transparent text-[#B5B3AD] cursor-default'
                                                            : 'bg-white border-[#E6E1DC] hover:border-[#9e1316]/30 hover:shadow-sm cursor-pointer'
                                                }`}
                                            >
                                                <span className="flex items-center gap-3 min-w-0">
                                                    {/* The ship drawn at its length, one square per deck. */}
                                                    <span className="flex gap-[2px] shrink-0">
                                                        {Array.from({ length: ship.size }).map((_, i) => (
                                                            <span key={i} className={`w-2.5 h-2.5 ${isSelected ? 'bg-white' : isFull ? 'bg-[#DAD7D1]' : 'bg-[#1A1F26]'}`} />
                                                        ))}
                                                    </span>
                                                    <span className="text-sm font-bold truncate">{shipName(ship.type)}</span>
                                                </span>
                                                <span className="text-xs font-black tabular-nums shrink-0">{placedCount}/{ship.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-2 mt-3">
                                    <button onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 ${BUTTON_SECONDARY}`}>
                                        <RotateCw className={`w-4 h-4 transition-transform duration-300 ${orientation === 'vertical' ? 'rotate-90' : ''}`} /> {t[orientation]}
                                    </button>
                                    <button onClick={clearShips} className={`flex items-center justify-center gap-2 px-3.5 py-2.5 ${BUTTON_DANGER_QUIET}`}>
                                        <Trash2 className="w-4 h-4" /> {t.clear}
                                    </button>
                                </div>

                                <p className="mt-3 text-xs font-medium text-[#8A9099] leading-snug">{t.setupHint}</p>

                                <div className="flex gap-2 mt-4 pt-4 border-t border-[#F1F5F9]">
                                    <button onClick={autoPlaceShips} className={`flex-1 flex items-center justify-center gap-2 py-3 ${BUTTON_SECONDARY}`}>
                                        <Shuffle className="w-4 h-4" /> {t.auto}
                                    </button>
                                    <button onClick={submitShips} disabled={myShips.length < 10 || me?.isReady} className={`flex-[2] flex items-center justify-center gap-2 py-3 ${BUTTON_PRIMARY}`}>
                                        {me?.isReady ? t.waiting : t.ready} <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </GameCard>

                            <PlayersCard
                                lang={lang}
                                rows={[
                                    ...(me ? [{ id: me.id, name: me.name, avatarUrl: me.avatarUrl, isHost: me.isHost, isMe: true, stat: statusLine(me.isReady) }] : []),
                                    ...(opponent ? [{ id: opponent.id, name: opponent.name, avatarUrl: opponent.avatarUrl, isHost: opponent.isHost, stat: statusLine(opponent.isReady) }] : [])
                                ]}
                            />
                        </>
                    }
                />
            )}

            {(phase === 'playing' || isFinished) && (
                <GameLayout
                    boardWidth={440}
                    board={radar}
                    side={
                        <>
                            <TurnCard
                                lang={lang}
                                who={turnHolder ? { name: turnHolder.name, isMe: isMyTurn, avatarUrl: turnHolder.avatarUrl } : null}
                                hint={isMyTurn ? t.fireHint : t.thinking}
                                secondsLeft={phase === 'playing' ? timeLeft : undefined}
                                turnSeconds={60}
                                result={isFinished ? {
                                    won: iWon,
                                    title: resultTitle,
                                    detail: resultNote,
                                    hidden: resultHidden,
                                    onShow: () => setResultHidden(false)
                                } : undefined}
                            />

                            <GameCard label={t.zoneMe}>
                                <div className={gridClass}>
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10, y = Math.floor(i / 10);
                                        const { status, shipPart } = getMyCellContent(x, y);
                                        return <GridCell key={i} status={status} shipPart={shipPart} size="small" />;
                                    })}
                                </div>
                            </GameCard>

                            <PlayersCard
                                lang={lang}
                                rows={[me, opponent].filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({
                                    id: p.id,
                                    name: p.name,
                                    avatarUrl: p.avatarUrl,
                                    isHost: p.isHost,
                                    isMe: p.id === userId,
                                    active: !isFinished && gameState.turn === p.id,
                                    won: isFinished && gameState.winner === p.id,
                                    stat: <span className="tabular-nums">{t.afloat(p.aliveShipsCount ?? 0)}</span>
                                }))}
                            />

                            <GameCard label={t.stats}>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] mb-2">{t.zoneMe}</div>
                                        <FleetStatusList ships={myShips} names={t.ships} />
                                    </div>
                                    <div className="h-px bg-[#F1F5F9]" />
                                    <div>
                                        <div className="text-3xs font-bold uppercase tracking-wider text-[#8A9099] mb-2">{t.enemy}</div>
                                        <FleetStatusList ships={opponent?.ships || []} isEnemy={true} names={t.ships} />
                                    </div>
                                </div>
                            </GameCard>
                        </>
                    }
                />
            )}

            <ResultDialog
                lang={lang}
                open={isFinished && !resultHidden}
                onHide={() => setResultHidden(true)}
                won={iWon}
                title={resultTitle}
                note={resultNote}
                winners={winnerPlayer ? [{ id: winnerPlayer.id, name: winnerPlayer.name, avatarUrl: winnerPlayer.avatarUrl }] : []}
                gameId="battleship"
                parentState={gameState}
                onMenu={leaveGame}
            />
        </div>
    );
}
