// components/BattleshipGame.tsx
'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    RotateCw, Trash2, Check, Shuffle,
    Anchor, Trophy, LogOut, Timer, Crosshair, Map, Shield, User
} from 'lucide-react';
import { Ship, ShipType, FLEET_CONFIG, Orientation } from '@/types/battleship';
import { checkPlacement } from '@/hooks/useBattleshipGame';

const CELL_SIZE_L = "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10";
const CELL_SIZE_S = "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6";

const getShipColor = (type: ShipType) => {
    switch (type) {
        case 'battleship': return 'bg-[#1A1F26]';
        case 'cruiser': return 'bg-[#4B5563]';
        case 'destroyer': return 'bg-[#6B7280]';
        case 'submarine': return 'bg-[#9CA3AF]';
    }
};

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
        menu: 'В Меню',
        zoneEnemy: 'Радар',
        zoneMe: 'Мой Флот',
        rotate: 'Повернуть',
        clear: 'Сброс',
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
        menu: 'Menu',
        zoneEnemy: 'Radar',
        zoneMe: 'My Fleet',
        rotate: 'Rotate',
        clear: 'Reset',
        instructions: 'Tap ship, then tap grid'
    }
};

// --- GRID CELL (Optimized for Mobile & Perf) ---
const GridCell = memo(({
    x, y, status, shipPart, onClick, isHovered, hoverValid, size = 'large'
}: any) => {
    const isSmall = size === 'small';
    let content = null;

    let bgClass = "bg-[#F5F5F0]";
    let borderClass = isSmall ? "border-[0.5px] border-[#E6E1DC]" : "border border-[#E6E1DC]";

    if (status === 'miss') {
        content = <div className={`${isSmall ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-[#8A9099]/40`} />;
    } else if (status === 'hit') {
        bgClass = "bg-red-50";
        content = <span className={`${isSmall ? 'text-[10px]' : 'text-xl'} text-[#9e1316] font-black leading-none`}>✕</span>;
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
        bgClass = hoverValid ? "bg-emerald-500/20 ring-2 ring-emerald-500 inset" : "bg-red-500/20 ring-2 ring-red-500 inset";
    }

    const cursorClass = onClick ? 'cursor-pointer active:scale-95' : 'cursor-default';

    return (
        <div onClick={onClick} className={`${isSmall ? CELL_SIZE_S : CELL_SIZE_L} ${borderClass} ${bgClass} ${cursorClass} flex items-center justify-center transition-all duration-150 select-none relative`}>
            {content}
        </div>
    );
});
GridCell.displayName = 'GridCell';

export default function BattleshipGame({
    gameState, userId, myShips, autoPlaceShips, clearShips,
    placeShipManual, removeShip, submitShips, fireShot, leaveGame, handleTimeout, lang
}: any) {
    const [orientation, setOrientation] = useState<Orientation>('horizontal');
    const [selectedType, setSelectedType] = useState<ShipType | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);

    const t = DICTIONARY[lang as 'ru' | 'en'] || DICTIONARY['ru'];
    const me = userId ? gameState.players[userId] : null;
    const opponentId = Object.keys(gameState.players).find(id => id !== userId);
    const opponent = opponentId ? gameState.players[opponentId] : null;
    const isMyTurn = gameState.turn === userId;
    const phase = gameState.phase;

    // --- TIMER SYNC ---
    useEffect(() => {
        if (phase !== 'playing') return;
        const interval = setInterval(() => {
            if (gameState.turnDeadline) {
                const remaining = Math.max(0, Math.ceil((gameState.turnDeadline - Date.now()) / 1000));
                setTimeLeft(remaining);
                if (remaining === 0 && isMyTurn) handleTimeout();
            }
        }, 500);
        return () => clearInterval(interval);
    }, [gameState.turnDeadline, phase, isMyTurn, handleTimeout]);

    // --- KEYBOARD & CONTROLS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['Space', 'KeyR'].includes(e.code)) {
                e.preventDefault();
                setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const getMyCellContent = useCallback((x: number, y: number) => {
        const s = myShips.find((s: Ship) => {
            if (s.orientation === 'horizontal') return s.position.y === y && x >= s.position.x && x < s.position.x + s.size;
            return s.position.x === x && y >= s.position.y && y < s.position.y + s.size;
        });
        const shot = phase === 'playing' && opponent?.shots ? opponent.shots[`${x},${y}`] : null;
        return { status: shot || 'empty', shipPart: s?.type, ship: s };
    }, [myShips, phase, opponent?.shots]);

    const getOpponentCellContent = useCallback((x: number, y: number) => {
        const shot = me?.shots[`${x},${y}`];
        return { status: shot || 'empty' };
    }, [me?.shots]);

    // --- TAP-BASED INTERACTION (Fixes Mobile) ---
    const handleCellClick = (x: number, y: number) => {
        if (phase === 'setup') {
            if (selectedType) {
                // Place ship
                const config = FLEET_CONFIG.find(c => c.type === selectedType);
                if (!config) return;

                const newShip: Ship = {
                    id: `${selectedType}-${Date.now()}`,
                    type: selectedType,
                    size: config.size,
                    orientation,
                    position: { x, y },
                    hits: 0
                };

                if (placeShipManual(newShip)) {
                    const currentCount = myShips.filter((s: Ship) => s.type === selectedType).length + 1;
                    if (currentCount >= config.count) setSelectedType(null); // Deselect if done
                }
            } else {
                // Remove ship
                const { ship } = getMyCellContent(x, y);
                if (ship) {
                    removeShip(ship.id);
                    setSelectedType(ship.type);
                    setOrientation(ship.orientation);
                }
            }
        } else if (phase === 'playing' && isMyTurn) {
            fireShot(x, y);
        }
    };

    if (phase === 'finished') {
        return (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
                <div className="bg-white p-10 rounded-[32px] text-center border-4 border-[#9e1316] shadow-2xl max-w-sm w-full">
                    <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
                        {gameState.winner === userId ? t.victory : t.defeat}
                    </h2>
                    <button onClick={() => { leaveGame(); window.location.href='/'; }} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors">
                        {t.menu}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

            <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
                <button onClick={() => { leaveGame(); window.location.href='/play' }} className="p-3 bg-white border border-[#E6E1DC] rounded-xl text-gray-400 hover:text-[#9e1316] transition-all"><LogOut className="w-5 h-5" /></button>
                <div className="text-center">
                    <h1 className="font-black text-2xl flex items-center gap-2 justify-center text-[#1A1F26] tracking-tight"><Anchor className="w-6 h-6 text-[#9e1316]"/> BATTLESHIP</h1>
                    <div className="text-[10px] font-bold text-[#9e1316] uppercase flex items-center gap-2 justify-center mt-1 bg-[#9e1316]/5 px-3 py-1 rounded-full border border-[#9e1316]/10">
                        {phase === 'setup' ? t.deployment : (isMyTurn ? t.yourTurn : t.enemyTurn)}
                        {phase === 'playing' && <span className={`flex items-center gap-1 ml-2 ${timeLeft < 15 ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}><Timer className="w-3 h-3"/> {timeLeft}s</span>}
                    </div>
                </div>
                <div className="w-12" />
            </header>

            <main className="flex-1 flex flex-col items-center justify-start p-2 sm:p-4 z-10 gap-4 overflow-y-auto custom-scrollbar w-full">
                {phase === 'setup' && (
                    <div className="flex flex-col w-full max-w-5xl gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <div className="flex flex-col-reverse lg:flex-row gap-6 w-full">
                             {/* Board */}
                             <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-xl border border-[#E6E1DC] mx-auto relative group">
                                <div className="grid grid-cols-10 gap-px bg-[#E6E1DC] border-4 border-[#1A1F26] overflow-hidden rounded-xl shadow-inner">
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10, y = Math.floor(i / 10);
                                        const { shipPart } = getMyCellContent(x, y);
                                        // Simplified hover logic for mobile compatibility
                                        let isHovered = false;
                                        if (selectedType) {
                                            const config = FLEET_CONFIG.find(c => c.type === selectedType);
                                            if (config) {
                                                const shipCoords = [];
                                                for(let k=0; k<config.size; k++) {
                                                     shipCoords.push({x: orientation === 'horizontal' ? x + k : x, y: orientation === 'vertical' ? y + k : y});
                                                }
                                                if(shipCoords.some(c => c.x === x && c.y === y)) isHovered = true;
                                            }
                                        }
                                        return <GridCell key={i} x={x} y={y} status={'empty'} shipPart={shipPart} onClick={() => handleCellClick(x, y)} isHovered={isHovered} hoverValid={true} />;
                                    })}
                                </div>
                                <div className="flex justify-between items-center mt-6 bg-[#F8FAFC] p-2 rounded-2xl border border-[#E6E1DC]">
                                    <button onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className="flex items-center gap-2 text-xs font-bold uppercase text-[#1A1F26] px-4 py-2 rounded-xl transition-all hover:bg-white border border-transparent hover:border-[#E6E1DC]">
                                        <RotateCw className={`w-4 h-4 transition-transform duration-300 ${orientation === 'vertical' ? 'rotate-90' : ''}`} /> {t[orientation] || t.rotate}
                                    </button>
                                    <button onClick={clearShips} className="text-[#8A9099] hover:text-red-500 p-2 rounded-xl"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                            {/* Dock */}
                            <div className="flex-1 w-full space-y-4">
                                <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-[#E6E1DC]">
                                    <h3 className="text-xs font-black uppercase mb-4 text-[#8A9099] flex items-center gap-2 tracking-widest pl-2"><Map className="w-4 h-4 text-[#1A1F26]"/> {t.fleet}</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                                        {FLEET_CONFIG.map(ship => {
                                            const placedCount = myShips.filter((s: Ship) => s.type === ship.type).length;
                                            const isFull = placedCount >= ship.count;
                                            const isSelected = selectedType === ship.type;
                                            return (
                                                <div
                                                    key={ship.type}
                                                    onClick={() => !isFull && setSelectedType(ship.type)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${isFull ? 'bg-[#F8FAFC] border-transparent opacity-40 grayscale cursor-default' : ''} ${isSelected ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg scale-[1.02]' : 'bg-white border-[#F5F5F0] hover:border-[#E6E1DC]'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center text-[10px] font-black text-[#8A9099]">{ship.size}x</div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider">{ship.type}</span>
                                                    </div>
                                                    <span className="text-xs font-black">{placedCount}/{ship.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-center text-gray-400 mt-4 uppercase font-bold">{t.instructions}</p>
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
                    <div className="flex flex-col w-full max-w-4xl gap-6 animate-in fade-in">
                        <div className="flex justify-between items-center bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md">{me?.avatarUrl ? <img src={me.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-auto mt-2 text-gray-400"/>}</div>
                                <div className="hidden sm:block"><div className="font-black text-xs uppercase">{me?.name}</div><div className="text-[10px] text-emerald-600 font-bold">{me?.aliveShipsCount} ships</div></div>
                            </div>
                            <div className={`text-xs font-black uppercase px-4 py-2 rounded-full border ${isMyTurn ? 'bg-[#9e1316] text-white border-[#9e1316]' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {isMyTurn ? t.yourTurn : t.enemyTurn}
                            </div>
                            <div className="flex items-center gap-3 text-right">
                                <div className="hidden sm:block"><div className="font-black text-xs uppercase">{opponent?.name}</div><div className="text-[10px] text-red-600 font-bold">{opponent?.aliveShipsCount} ships</div></div>
                                <div className="w-10 h-10 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md opacity-80">{opponent?.avatarUrl ? <img src={opponent.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-5 h-5 m-auto mt-2 text-gray-400"/>}</div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
                            {/* Enemy Board */}
                            <div className="flex-1 w-full max-w-sm mx-auto order-1 md:order-2">
                                <div className={`bg-white p-4 sm:p-6 rounded-[32px] shadow-2xl border-4 transition-all duration-500 relative ${isMyTurn ? 'border-[#9e1316] shadow-[#9e1316]/20 z-10 scale-100' : 'border-[#E6E1DC] opacity-90 scale-95'}`}>
                                    <div className="absolute top-4 left-6 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Crosshair className="w-4 h-4"/> {t.zoneEnemy}</div>
                                    <div className="mt-6 grid grid-cols-10 gap-px bg-[#E6E1DC] border-2 border-[#1A1F26] rounded-xl overflow-hidden cursor-crosshair">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10, y = Math.floor(i / 10);
                                            const { status } = getOpponentCellContent(x, y);
                                            return <GridCell key={i} x={x} y={y} status={status} onClick={() => isMyTurn && status === 'empty' && fireShot(x, y)} />;
                                        })}
                                    </div>
                                </div>
                            </div>
                            {/* My Board */}
                            <div className="w-full max-w-[200px] mx-auto order-2 md:order-1">
                                <div className="bg-white p-4 rounded-[24px] shadow-lg border border-[#E6E1DC] opacity-90 hover:opacity-100 transition-opacity">
                                    <div className="mb-4 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3"/> {t.zoneMe}</div>
                                    <div className="grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC] w-full rounded overflow-hidden">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10, y = Math.floor(i / 10);
                                            const { status, shipPart } = getMyCellContent(x, y);
                                            return <GridCell key={i} x={x} y={y} status={status} shipPart={shipPart} size="small" />;
                                        })}
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