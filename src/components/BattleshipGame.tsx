'use client';

import Image from 'next/image';
import React, { useState, useEffect, memo } from 'react';
import {
    RotateCw, Trash2, Check, Shuffle,
    Anchor, Trophy, Crosshair, Map, Shield, BarChart3, User, AlertCircle
} from 'lucide-react';
import { Ship, ShipType, FLEET_CONFIG, Orientation, Coordinate, CellStatus, BattleshipState } from '@/types/battleship';
import { checkPlacement } from '@/lib/gameLogic/battleship';
import GameHeader from './GameHeader';
import RematchButton from './RematchButton';
import GameRulesModal from './GameRulesModal';
import { GAME_RULES } from '@/constants/rules';
import { playSfx } from '@/lib/sound';
import { useGameKeys } from '@/hooks/useGameKeys';
import { isRotate } from '@/lib/keys';

const CELL_SIZE_L = "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10";
const CELL_SIZE_S = "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6";

const DICTIONARY = {
    ru: {
        deployment: 'Развертывание',
        yourTurn: 'ВАШ ХОД',
        enemyTurn: 'ХОД ПРОТИВНИКА',
        fleet: 'Верфь',
        auto: 'Авто',
        ready: 'ГОТОВ',
        placing: 'РАССТАНОВКА...',
        waiting: 'Ожидание...',
        victory: 'ПОБЕДА',
        defeat: 'ПОРАЖЕНИЕ',
        winMsg: 'Вражеский флот уничтожен',
        loseMsg: 'Наш флот пошел ко дну',
        surrenderMsg: 'Противник покинул бой',
        menu: 'В Меню',
        zoneEnemy: 'Радар',
        zoneMe: 'Мой Флот',
        shipsAlive: 'Состояние Флота',
        enemy: 'Противник',
        dragHint: 'Перетащите корабли. R или пробел — поворот.',
        rotate: 'Повернуть',
        clear: 'Сброс',
        horizontal: 'ГОРИЗОНТАЛЬНО',
        vertical: 'ВЕРТИКАЛЬНО',
        stats: 'Статистика',
        shots: 'Выстр.',
        accuracy: 'Точн.',
        hits: 'Попад.',
        waitingOpponent: 'Ожидание соперника...',
        instructions: 'Нажмите на корабль, затем на клетку'
    },
    en: {
        deployment: 'Deployment',
        yourTurn: 'YOUR TURN',
        enemyTurn: 'ENEMY TURN',
        fleet: 'Shipyard',
        auto: 'Auto',
        ready: 'READY',
        placing: 'PLACING...',
        waiting: 'Waiting...',
        victory: 'VICTORY',
        defeat: 'DEFEAT',
        winMsg: 'Enemy fleet destroyed',
        loseMsg: 'Our fleet has sunk',
        surrenderMsg: 'Opponent surrendered',
        menu: 'Menu',
        zoneEnemy: 'Radar',
        zoneMe: 'My Fleet',
        shipsAlive: 'Fleet Status',
        enemy: 'Enemy',
        dragHint: 'Drag ships. R or Space to rotate.',
        rotate: 'Rotate',
        clear: 'Reset',
        horizontal: 'HORIZONTAL',
        vertical: 'VERTICAL',
        stats: 'Stats',
        shots: 'Shots',
        accuracy: 'Acc.',
        hits: 'Hits',
        waitingOpponent: 'Waiting for opponent...',
        instructions: 'Tap ship, then tap grid'
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

    let bgClass = "bg-[#F5F5F0]";
    let borderClass = isSmall ? "border-[0.5px] border-[#E6E1DC]" : "border border-[#E6E1DC]";

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

const FleetStatusList = ({ ships, isEnemy = false }: { ships: Ship[], isEnemy?: boolean }) => {
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
                        <span className="font-bold uppercase text-[#8A9099] w-16">{g.type.slice(0, 4)}</span>
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

    if (phase === 'finished') {
        const isWinner = gameState.winner === userId;
        const enemyShipsSunk = opponent?.aliveShipsCount === 0;
        const isSurrender = isWinner && !enemyShipsSunk;

        return (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
                <div className="bg-white p-10 rounded-[32px] text-center animate-in zoom-in duration-300 border-4 border-[#9e1316] shadow-2xl max-w-sm w-full relative overflow-hidden">
                    <div className="relative z-10">
                        {isWinner ? (
                            <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce" />
                        ) : (
                            <AlertCircle className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                        )}
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
                            {isWinner ? t.victory : t.defeat}
                        </h2>
                        <p className="text-2xl font-black text-[#1A1F26] mb-8 leading-tight">
                            {isSurrender ? t.surrenderMsg : (isWinner ? t.winMsg : t.loseMsg)}
                        </p>
                        <div className="flex flex-col gap-3">
                          <RematchButton
                            gameId="battleship"
                            parentState={gameState}
                            lang={lang}
                            className="w-full py-4 border border-[#E6E1DC] text-[#1A1F26] rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#F8FAFC] transition-colors"
                          />
                          {/* leaveGame (handleLeave) awaits the DB write and navigates by itself */}
                          <button onClick={leaveGame} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors">{t.menu}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        // Bottom padding is room for the chat button: on a phone "ready" is
        // the last thing on the page and would otherwise stop underneath it.
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative pb-24">
            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

            <GameHeader
                title="Battleship"
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

            <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-6 overflow-y-auto custom-scrollbar w-full">
                {phase === 'setup' && (
                    <div className="flex flex-col w-full max-w-5xl gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm w-full">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md">{me?.avatarUrl ? <Image src={me.avatarUrl} alt="" width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-auto mt-2 text-gray-400"/>}</div>
                                <div><div className="font-black text-sm uppercase">{me?.name || 'You'}</div><div className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${me?.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{me?.isReady ? t.ready : t.placing}</div></div>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <div><div className="font-black text-sm uppercase">{opponent?.name || t.enemy}</div><div className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${opponent?.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{opponent?.isReady ? t.ready : (!opponent ? t.waiting : t.placing)}</div></div>
                                <div className="w-12 h-12 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md opacity-80">{opponent?.avatarUrl ? <Image src={opponent.avatarUrl} alt="" width={48} height={48} className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-auto mt-2 text-gray-400"/>}</div>
                            </div>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                            <div className="bg-white p-6 rounded-[32px] shadow-xl border border-[#E6E1DC] relative mx-auto lg:mx-0 group w-full lg:w-auto">
                                <div className="grid grid-cols-10 gap-px bg-[#E6E1DC] border-4 border-[#1A1F26] overflow-hidden rounded-xl cursor-crosshair shadow-inner" onMouseLeave={() => setHoverPos(null)}>
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10, y = Math.floor(i / 10);
                                        const { shipPart, ship } = getMyCellContent(x, y);
                                        const isHovered = isPhantomCell(x, y);
                                        const isValid = isHovered ? isPlacementValid : false;

                                        return <GridCell key={i} status={'empty'} shipPart={shipPart} onClick={() => handleCellClick(x, y)} onMouseEnter={() => setHoverPos({x, y})} onDrop={(e) => handleDrop(e, x, y)} onDragOver={(e) => {e.preventDefault(); setHoverPos({x, y})}} onDragStart={(e) => ship && handleDragStartBoard(e, ship)} onContextMenu={(e) => {e.preventDefault(); setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}} isHovered={isHovered} hoverValid={isValid} />;
                                    })}
                                </div>
                                <div className="flex justify-between items-center mt-6 bg-[#F8FAFC] p-2 rounded-2xl border border-[#E6E1DC]">
                                    <button onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className="flex items-center gap-2 text-xs font-bold uppercase text-[#1A1F26] px-4 py-2 rounded-xl transition-all hover:bg-white border border-transparent hover:border-[#E6E1DC]">
                                        <RotateCw className={`w-4 h-4 transition-transform duration-300 ${orientation === 'vertical' ? 'rotate-90' : ''}`} /> {t[orientation] || t.rotate}
                                    </button>
                                    <button onClick={clearShips} className="text-[#8A9099] hover:text-red-500 p-2 rounded-xl"><Trash2 className="w-4 h-4"/> {t.clear}</button>
                                </div>
                            </div>
                            <div className="flex-1 w-full space-y-6">
                                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E6E1DC]">
                                    <h3 className="text-xs font-black uppercase mb-6 text-[#8A9099] flex items-center gap-2 tracking-widest pl-2"><Map className="w-4 h-4 text-[#1A1F26]"/> {t.fleet}</h3>
                                    <div className="grid grid-cols-4 lg:grid-cols-1 gap-3">
                                        {FLEET_CONFIG.map(ship => {
                                            const placedCount = myShips.filter((s: Ship) => s.type === ship.type).length;
                                            const isFull = placedCount >= ship.count;
                                            const isSelected = selectedType === ship.type;
                                            return (
                                                <div key={ship.type} draggable={!isFull} onDragStart={(e) => handleDragStartMenu(e, ship.type)} onClick={() => !isFull && setSelectedType(ship.type)} className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${isFull ? 'bg-[#F8FAFC] border-transparent opacity-40 grayscale cursor-default' : ''} ${isSelected ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg scale-[1.02]' : 'bg-white border-[#F5F5F0] hover:border-[#E6E1DC]'}`}>
                                                    <div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center text-2xs font-black text-[#8A9099]">{ship.size}x</div><span className="hidden lg:inline text-2xs font-bold uppercase tracking-wider">{ship.type}</span></div><span className="text-xs font-black">{placedCount}/{ship.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-2xs text-center text-gray-400 mt-4 uppercase font-bold hidden lg:block">{t.instructions}</p>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={autoPlaceShips} className="flex-1 py-4 bg-white border-2 border-[#E6E1DC] text-[#1A1F26] rounded-2xl font-bold text-xs uppercase hover:bg-[#F8FAFC] flex items-center justify-center gap-2"><Shuffle className="w-4 h-4" /> {t.auto}</button>
                                    <button onClick={submitShips} disabled={myShips.length < 10 || me?.isReady} className="flex-[2] py-4 bg-[#1A1F26] text-white rounded-2xl font-black text-xs uppercase hover:bg-[#9e1316] disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2 tracking-widest">{me?.isReady ? t.waiting : t.ready} <Check className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {phase === 'playing' && (
                    <div className="flex flex-col w-full max-w-6xl gap-6 animate-in fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[32px] border border-[#E6E1DC] shadow-sm w-full gap-4">
                            <div className="flex items-center gap-4 w-full md:w-1/3">
                                <div className="relative"><div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-[#F5F5F0]">{me?.avatarUrl ? <Image src={me.avatarUrl} alt="" width={56} height={56} className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-auto mt-2 text-gray-400"/>}</div>{isMyTurn && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse shadow-sm"></div>}</div>
                                <div className="flex flex-col"><span className="font-black text-[#1A1F26] text-sm uppercase tracking-tight">{me?.name || 'You'}</span><div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] bg-[#F5F5F0] px-2 py-0.5 rounded-lg mt-1"><Shield className="w-3 h-3 text-emerald-600" /><span>{me?.aliveShipsCount}/10</span></div></div>
                            </div>
                            <div className="flex flex-col items-center justify-center w-full md:w-1/3 order-first md:order-none"><div className={`text-2xs font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full border shadow-sm transition-all duration-300 ${isMyTurn ? 'bg-[#9e1316] text-white border-[#9e1316] scale-105' : 'bg-white text-[#8A9099] border-[#E6E1DC]'}`}>{isMyTurn ? t.yourTurn : t.enemyTurn}</div></div>
                            <div className="flex items-center gap-4 w-full md:w-1/3 justify-end">
                                <div className="flex flex-col items-end"><span className="font-black text-[#1A1F26] text-sm uppercase tracking-tight">{opponent?.name || t.enemy}</span><div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] bg-[#F5F5F0] px-2 py-0.5 rounded-lg mt-1"><span>{opponent?.aliveShipsCount}/10</span><Crosshair className="w-3 h-3 text-[#9e1316]" /></div></div>
                                <div className="relative"><div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-[#F5F5F0]">{opponent?.avatarUrl ? <Image src={opponent.avatarUrl} alt="" width={56} height={56} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400 m-auto mt-2" />}</div>{!isMyTurn && <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#9e1316] border-2 border-white rounded-full animate-pulse shadow-sm"></div>}</div>
                            </div>
                        </div>
                        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full">
                            <div className="flex-1 w-full max-w-lg mx-auto lg:order-2">
                                <div className={`bg-white p-6 rounded-[40px] shadow-2xl border-4 transition-all duration-500 relative ${isMyTurn ? 'border-[#9e1316] shadow-[#9e1316]/20 z-10' : 'border-[#E6E1DC] opacity-95'}`}>
                                    <div className="absolute top-8 left-8 text-2xs font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Crosshair className="w-4 h-4"/> {t.zoneEnemy}</div>
                                    <div className="mt-8 grid grid-cols-10 gap-px bg-[#E6E1DC] border-2 border-[#1A1F26] rounded-xl overflow-hidden cursor-crosshair">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10, y = Math.floor(i / 10);
                                            const { status } = getOpponentCellContent(x, y);
                                            return <GridCell key={i} status={status} onClick={() => isMyTurn && status === 'empty' && fireShot(x, y)} />;
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-6 lg:order-1 w-full max-w-xs mx-auto lg:mx-0">
                                <div className="bg-white p-5 rounded-[32px] shadow-lg border border-[#E6E1DC] opacity-90 hover:opacity-100 transition-opacity relative group">
                                    <div className="absolute top-5 left-5 text-2xs font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3"/> {t.zoneMe}</div>
                                    <div className="mt-8 grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC] w-fit mx-auto rounded overflow-hidden">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10, y = Math.floor(i / 10);
                                            const { status, shipPart } = getMyCellContent(x, y);
                                            return <GridCell key={i} status={status} shipPart={shipPart} size="small" />;
                                        })}
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E6E1DC] p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-[#1A1F26] tracking-widest mb-2 relative z-10"><BarChart3 className="w-4 h-4 text-[#9e1316]" /> {t.stats}</div>
                                    <div className="space-y-4">
                                        <div className="space-y-1"><div className="text-3xs font-bold uppercase text-[#8A9099] mb-2">{t.zoneMe}</div><FleetStatusList ships={myShips} isEnemy={false} /></div>
                                        <div className="h-px bg-[#F5F5F0] w-full" />
                                        <div className="space-y-1"><div className="text-3xs font-bold uppercase text-[#8A9099] mb-2">{t.enemy}</div><FleetStatusList ships={opponent?.ships || []} isEnemy={true} /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}