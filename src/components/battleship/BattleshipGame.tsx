'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    RotateCw, Trash2, Check, Shuffle,
    Anchor, Trophy, LogOut, Timer, Crosshair, Map, Shield, Target, BarChart3, User, AlertCircle
} from 'lucide-react';
import { Ship, CellStatus, Coordinate, ShipType, FLEET_CONFIG, Orientation } from '@/types/battleship';
import { checkPlacement } from '@/hooks/useBattleshipGame';

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
        menu: 'В Меню',
        zoneEnemy: 'Радар',
        zoneMe: 'Мой Флот',
        shipsAlive: 'Состояние Флота',
        enemy: 'Противник',
        dragHint: 'Перетащите корабли. Пробел/Q для поворота.',
        rotate: 'Повернуть',
        clear: 'Сброс',
        horizontal: 'ГОРИЗОНТАЛЬНО',
        vertical: 'ВЕРТИКАЛЬНО',
        stats: 'Статистика',
        shots: 'Выстр.',
        accuracy: 'Точн.',
        hits: 'Попад.',
        waitingOpponent: 'Ожидание соперника...'
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
        menu: 'Menu',
        zoneEnemy: 'Radar',
        zoneMe: 'My Fleet',
        shipsAlive: 'Fleet Status',
        enemy: 'Enemy',
        dragHint: 'Drag ships. Space/Q to rotate.',
        rotate: 'Rotate',
        clear: 'Reset',
        horizontal: 'HORIZONTAL',
        vertical: 'VERTICAL',
        stats: 'Stats',
        shots: 'Shots',
        accuracy: 'Acc.',
        hits: 'Hits',
        waitingOpponent: 'Waiting for opponent...'
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

// --- КОМПОНЕНТ ЯЧЕЙКИ ---
const GridCell = ({
    x, y, status, shipPart, onClick, onMouseEnter, onContextMenu,
    onDrop, onDragOver, onDragStart, isHovered, hoverValid, size = 'large'
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
};

// --- КОМПОНЕНТ СПИСКА КОРАБЛЕЙ (Fleet Status) ---
const FleetStatusList = ({ ships, isEnemy = false }: { ships: Ship[], isEnemy?: boolean }) => {
    // Группируем корабли по типам для отображения
    const groups = FLEET_CONFIG.map(config => {
        const typeShips = ships.filter(s => s.type === config.type);
        // Для врага: показываем столько слотов, сколько всего кораблей этого типа.
        // Зачеркиваем, если корабль убит (hits >= size).
        // Для себя: показываем здоровье.

        return {
            ...config,
            ships: typeShips
        };
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
                        {/* Если это враг, мы не знаем список его кораблей в деталях, но мы знаем массив ships из стейта.
                            В реальной игре мы должны фильтровать killed ships. */}
                        {g.ships.map((s, i) => {
                            const isDead = s.hits >= s.size;
                            const hpPercent = Math.max(0, (s.size - s.hits) / s.size) * 100;

                            if (isEnemy) {
                                return (
                                    <div key={i} className={`w-8 h-2 rounded-sm border ${isDead ? 'bg-[#9e1316]/20 border-[#9e1316] relative overflow-hidden' : 'bg-[#F5F5F0] border-[#E6E1DC]'}`}>
                                        {isDead && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-[#9e1316] font-bold">✕</div>}
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={i} className="w-8 h-2 rounded-sm bg-[#F5F5F0] border border-[#E6E1DC] overflow-hidden relative">
                                        <div
                                            className={`absolute top-0 left-0 h-full transition-all duration-500 ${isDead ? 'bg-[#9e1316]' : hpPercent < 50 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${hpPercent}%` }}
                                        />
                                    </div>
                                );
                            }
                        })}
                        {/* Заполнители для еще не созданных кораблей (если вдруг массив не полон, хотя в playing он полон) */}
                        {Array.from({ length: Math.max(0, g.count - g.ships.length) }).map((_, i) => (
                             <div key={`placeholder-${i}`} className="w-8 h-2 rounded-sm bg-gray-100 border border-dashed border-gray-300" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};


export default function BattleshipGame({
    gameState, userId, myShips, autoPlaceShips, clearShips,
    placeShipManual, removeShip, submitShips, fireShot, leaveGame, lang
}: any) {
    const [orientation, setOrientation] = useState<Orientation>('horizontal');
    const [selectedType, setSelectedType] = useState<ShipType | null>(null);
    const [hoverPos, setHoverPos] = useState<Coordinate | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);
    const [movingShipId, setMovingShipId] = useState<string | null>(null);

    const t = DICTIONARY[lang as 'ru' | 'en'] || DICTIONARY['ru'];

    const me = userId ? gameState.players[userId] : null;
    const opponentId = Object.keys(gameState.players).find(id => id !== userId);
    const opponent = opponentId ? gameState.players[opponentId] : null;
    const isMyTurn = gameState.turn === userId;
    const phase = gameState.phase;

    useEffect(() => {
        if (phase !== 'playing') return;
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - (gameState.lastActionTime || Date.now())) / 1000);
            setTimeLeft(Math.max(0, 60 - elapsed));
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState.lastActionTime, phase]);

    // Keyboard Rotation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['Space', 'KeyQ', 'KeyE', 'KeyR'].includes(e.code)) {
                e.preventDefault();
                setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- Helpers ---

    const getMyCellContent = (x: number, y: number) => {
        const s = myShips.find((s: Ship) => {
            if (movingShipId === s.id) return false;
            if (s.orientation === 'horizontal') return s.position.y === y && x >= s.position.x && x < s.position.x + s.size;
            return s.position.x === x && y >= s.position.y && y < s.position.y + s.size;
        });
        const shot = phase === 'playing' && opponent?.shots ? opponent.shots[`${x},${y}`] : null;
        return { status: shot || 'empty', shipPart: s?.type, ship: s };
    };

    const getOpponentCellContent = (x: number, y: number) => {
        const shot = me?.shots[`${x},${y}`];
        return { status: shot || 'empty' };
    };

    const getStats = (playerBoard: any) => {
        if (!playerBoard?.shots) return { shots: 0, hits: 0, accuracy: 0 };
        const shots = Object.values(playerBoard.shots);
        const total = shots.length;
        const hits = shots.filter((s: any) => s === 'hit' || s === 'killed').length;
        return {
            shots: total,
            hits: hits,
            accuracy: total > 0 ? Math.round((hits / total) * 100) : 0
        };
    };

    const myStats = getStats(me);

    // --- Drag & Placement Logic ---

    const tryPlaceShip = (x: number, y: number, type: ShipType, existingId?: string) => {
        const config = FLEET_CONFIG.find(c => c.type === type);
        if (!config) return;

        if (!existingId) {
            const count = myShips.filter((s: Ship) => s.type === type).length;
            if (count >= config.count) return;
        }

        const newShip: Ship = {
            id: existingId || `${type}-${Date.now()}`,
            type: type,
            size: config.size,
            orientation,
            position: { x, y },
            hits: 0
        };

        const success = placeShipManual(newShip);
        if (success) {
            if (!existingId) {
                const newCount = myShips.filter((s: Ship) => s.type === type).length + 1;
                if (newCount >= config.count) setSelectedType(null);
            }
            setMovingShipId(null);
        }
    };

    const handleCellClick = (x: number, y: number) => {
        if (selectedType) {
            tryPlaceShip(x, y, selectedType);
            return;
        }
        const { ship } = getMyCellContent(x, y);
        if (ship) {
            removeShip(ship.id);
            setSelectedType(ship.type);
            setOrientation(ship.orientation);
            setHoverPos({ x, y });
        }
    };

    const hideDragImage = (e: React.DragEvent) => {
        if (typeof window !== 'undefined') {
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(img, 0, 0);
        }
    };

    const handleDragStartMenu = (e: React.DragEvent, type: ShipType) => {
        hideDragImage(e);
        setSelectedType(type);
        e.dataTransfer.setData('type', type);
    };

    const handleDragStartBoard = (e: React.DragEvent, ship: Ship) => {
        hideDragImage(e);
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

    const handleDragOver = (e: React.DragEvent, x: number, y: number) => {
        e.preventDefault();
        if (hoverPos?.x !== x || hoverPos?.y !== y) {
            setHoverPos({ x, y });
        }
    };

    const isPhantomCell = (x: number, y: number) => {
        if (!hoverPos || !selectedType) return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedType)!;
        if (orientation === 'horizontal') {
             return y === hoverPos.y && x >= hoverPos.x && x < hoverPos.x + config.size;
        } else {
             return x === hoverPos.x && y >= hoverPos.y && y < hoverPos.y + config.size;
        }
    };

    const checkPhantomValidity = (x: number, y: number) => {
        if (!selectedType || !hoverPos) return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedType)!;
        const tempShip: Ship = {
            id: 'temp',
            type: selectedType,
            size: config.size,
            orientation,
            position: { x: hoverPos.x, y: hoverPos.y },
            hits: 0
        };
        return checkPlacement(myShips, tempShip, movingShipId || undefined);
    };

    // --- FINISHED SCREEN ---
    if (phase === 'finished') return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
            <div className="bg-white p-10 rounded-[32px] text-center animate-in zoom-in duration-300 border-4 border-[#9e1316] shadow-2xl max-w-sm w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                <div className="relative z-10">
                    <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce drop-shadow-md" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">{gameState.winner === userId ? t.victory : t.defeat}</h2>
                    <p className="text-3xl font-black text-[#1A1F26] mb-8">{gameState.winner === userId ? t.winMsg : t.loseMsg}</p>
                    <button onClick={() => { leaveGame(); window.location.href='/'; }} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg">
                        {t.menu}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative selection:bg-[#9e1316] selection:text-white">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

            {/* HEADER */}
            <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
                <button onClick={() => { leaveGame(); window.location.href='/play' }} className="p-3 bg-white border border-[#E6E1DC] rounded-xl text-gray-400 hover:text-[#9e1316] hover:border-[#9e1316]/30 transition-all shadow-sm"><LogOut className="w-5 h-5" /></button>
                <div className="text-center">
                    <h1 className="font-black text-2xl flex items-center gap-2 justify-center text-[#1A1F26] tracking-tight">
                        <Anchor className="w-6 h-6 text-[#9e1316]"/> BATTLESHIP
                    </h1>
                    <div className="text-[10px] font-bold text-[#9e1316] uppercase flex items-center gap-2 justify-center mt-1 bg-[#9e1316]/5 px-3 py-1 rounded-full border border-[#9e1316]/10">
                        {phase === 'setup' ? t.deployment : (isMyTurn ? t.yourTurn : t.enemyTurn)}
                        {phase === 'playing' && <span className={`flex items-center gap-1 ml-2 ${timeLeft < 15 ? 'text-red-600 animate-pulse' : 'text-gray-500'}`}><Timer className="w-3 h-3"/> {timeLeft}s</span>}
                    </div>
                </div>
                <div className="w-12" />
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-6 overflow-y-auto custom-scrollbar w-full">

                {/* --- SETUP PHASE --- */}
                {phase === 'setup' && (
                    <div className="flex flex-col w-full max-w-5xl gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* READY STATUS HEADER */}
                        <div className="flex justify-between items-center bg-white p-4 rounded-[24px] border border-[#E6E1DC] shadow-sm w-full">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md">
                                    {me?.avatarUrl ? <img src={me.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-auto mt-2 text-gray-400"/>}
                                </div>
                                <div>
                                    <div className="font-black text-sm uppercase">{me?.name || 'You'}</div>
                                    <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${me?.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {me?.isReady ? t.ready : t.placing}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center hidden md:block">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.dragHint}</div>
                            </div>

                            <div className="flex items-center gap-4 text-right">
                                <div>
                                    <div className="font-black text-sm uppercase">{opponent?.name || t.enemy}</div>
                                    <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${opponent?.isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {opponent?.isReady ? t.ready : (!opponent ? t.waiting : t.placing)}
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-[#F5F5F0] overflow-hidden border-2 border-white shadow-md opacity-80">
                                    {opponent?.avatarUrl ? <img src={opponent.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-auto mt-2 text-gray-400"/>}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
                            {/* BOARD */}
                            <div className="bg-white p-6 rounded-[32px] shadow-xl border border-[#E6E1DC] relative mx-auto lg:mx-0 group w-full lg:w-auto">
                                <div className="absolute -top-3 left-6 bg-[#1A1F26] text-white text-[10px] font-bold uppercase px-4 py-1.5 rounded-full tracking-widest shadow-lg border-2 border-white">
                                    {t.deployment}
                                </div>

                                <div
                                    className="grid grid-cols-10 gap-px bg-[#E6E1DC] border-4 border-[#1A1F26] overflow-hidden rounded-xl cursor-crosshair shadow-inner"
                                    onMouseLeave={() => setHoverPos(null)}
                                >
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10;
                                        const y = Math.floor(i / 10);
                                        const { shipPart, ship } = getMyCellContent(x, y);
                                        const isHovered = isPhantomCell(x, y);
                                        const isValid = isHovered ? checkPhantomValidity(x, y) : false;

                                        return (
                                            <GridCell
                                                key={i} x={x} y={y}
                                                status={'empty'}
                                                shipPart={shipPart}
                                                onClick={() => handleCellClick(x, y)}
                                                onMouseEnter={() => setHoverPos({x, y})}
                                                onDrop={(e: any) => handleDrop(e, x, y)}
                                                onDragOver={(e: any) => { e.preventDefault(); setHoverPos({x, y}); }}
                                                onDragStart={(e: any) => ship && handleDragStartBoard(e, ship)}
                                                onContextMenu={(e: any) => {
                                                    e.preventDefault();
                                                    setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
                                                }}
                                                isHovered={isHovered}
                                                hoverValid={isValid}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between items-center mt-6 bg-[#F8FAFC] p-2 rounded-2xl border border-[#E6E1DC]">
                                    <button
                                        onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
                                        className="flex items-center gap-2 text-xs font-bold uppercase text-[#1A1F26] hover:bg-white hover:shadow-sm px-4 py-2 rounded-xl transition-all"
                                    >
                                        <RotateCw className={`w-4 h-4 transition-transform duration-300 ${orientation === 'vertical' ? 'rotate-90' : ''}`} />
                                        {t[orientation]}
                                    </button>
                                    <button onClick={clearShips} className="text-[#8A9099] hover:text-[#9e1316] hover:bg-white hover:shadow-sm p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-bold uppercase px-4">
                                        <Trash2 className="w-4 h-4"/> {t.clear}
                                    </button>
                                </div>
                            </div>

                            {/* FLEET PANEL */}
                            <div className="flex-1 w-full space-y-6">
                                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E6E1DC]">
                                    <h3 className="text-xs font-black uppercase mb-6 text-[#8A9099] flex items-center gap-2 tracking-widest pl-2">
                                        <Map className="w-4 h-4 text-[#1A1F26]"/> {t.fleet}
                                    </h3>
                                    <div className="space-y-3">
                                        {FLEET_CONFIG.map(ship => {
                                            const placedCount = myShips.filter((s: Ship) => s.type === ship.type).length;
                                            const isFull = placedCount >= ship.count;
                                            const isSelected = selectedType === ship.type;

                                            return (
                                                <div
                                                    key={ship.type}
                                                    draggable={!isFull}
                                                    onDragStart={(e) => handleDragStartMenu(e, ship.type)}
                                                    onClick={() => !isFull && setSelectedType(ship.type)}
                                                    className={`
                                                        w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                                                        ${isFull ? 'bg-[#F8FAFC] border-transparent opacity-40 grayscale cursor-default' : ''}
                                                        ${isSelected ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg scale-[1.02]' : 'bg-white border-[#F5F5F0] hover:border-[#E6E1DC]'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center text-[10px] font-black text-[#8A9099]">
                                                            {ship.size}x
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider">{ship.type}</span>
                                                            <div className="flex gap-1 mt-1">
                                                                {Array.from({length: ship.size}).map((_, i) => (
                                                                    <div key={i} className={`w-3 h-3 rounded-sm ${isSelected ? 'bg-[#9e1316]' : 'bg-[#1A1F26]'}`} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black">{placedCount}/{ship.count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={autoPlaceShips} className="flex-1 py-4 bg-white border-2 border-[#E6E1DC] text-[#1A1F26] rounded-2xl font-bold text-xs uppercase hover:bg-[#F8FAFC] hover:border-gray-300 flex items-center justify-center gap-2 transition-all active:scale-95">
                                        <Shuffle className="w-4 h-4" /> {t.auto}
                                    </button>
                                    <button
                                        onClick={submitShips}
                                        disabled={myShips.length < 10 || me?.isReady}
                                        className="flex-[2] py-4 bg-[#1A1F26] text-white rounded-2xl font-black text-xs uppercase hover:bg-[#9e1316] disabled:opacity-50 disabled:hover:bg-[#1A1F26] transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 tracking-widest"
                                    >
                                        {me?.isReady ? t.waiting : t.ready} <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- BATTLE PHASE --- */}
                {phase === 'playing' && (
                    <div className="flex flex-col w-full max-w-6xl gap-6 animate-in fade-in">

                        {/* TOP STATUS PANEL */}
                        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-[32px] border border-[#E6E1DC] shadow-sm w-full gap-4">
                            {/* MY PROFILE */}
                            <div className="flex items-center gap-4 w-full md:w-1/3">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-[#F5F5F0]">
                                        {me?.avatarUrl ? <img src={me.avatarUrl} alt="Me" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400 m-auto mt-2" />}
                                    </div>
                                    {isMyTurn && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse shadow-sm"></div>}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-[#1A1F26] text-sm uppercase tracking-tight">{me?.name || 'You'}</span>
                                    <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] bg-[#F5F5F0] px-2 py-0.5 rounded-lg mt-1">
                                        <Shield className="w-3 h-3 text-emerald-600" />
                                        <span>{me?.aliveShipsCount}/10</span>
                                    </div>
                                </div>
                            </div>

                            {/* CENTER STATUS */}
                            <div className="flex flex-col items-center justify-center w-full md:w-1/3 order-first md:order-none">
                                <div className={`text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full border shadow-sm transition-all duration-300 ${isMyTurn ? 'bg-[#9e1316] text-white border-[#9e1316] scale-105' : 'bg-white text-[#8A9099] border-[#E6E1DC]'}`}>
                                    {isMyTurn ? t.yourTurn : t.enemyTurn}
                                </div>
                            </div>

                            {/* ENEMY PROFILE */}
                            <div className="flex items-center gap-4 w-full md:w-1/3 justify-end">
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-[#1A1F26] text-sm uppercase tracking-tight">{opponent?.name || t.enemy}</span>
                                    <div className="flex items-center gap-2 text-xs font-bold text-[#8A9099] bg-[#F5F5F0] px-2 py-0.5 rounded-lg mt-1">
                                        <span>{opponent?.aliveShipsCount}/10</span>
                                        <Crosshair className="w-3 h-3 text-[#9e1316]" />
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-[#F5F5F0]">
                                        {opponent?.avatarUrl ? <img src={opponent.avatarUrl} alt="Enemy" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400 m-auto mt-2" />}
                                    </div>
                                    {!isMyTurn && <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#9e1316] border-2 border-white rounded-full animate-pulse shadow-sm"></div>}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center w-full">

                            {/* ENEMY BOARD (RADAR) */}
                            <div className="flex-1 w-full max-w-lg mx-auto lg:order-2">
                                <div className={`bg-white p-6 rounded-[40px] shadow-2xl border-4 transition-all duration-500 relative ${isMyTurn ? 'border-[#9e1316] shadow-[#9e1316]/20 z-10' : 'border-[#E6E1DC] opacity-95'}`}>
                                    <div className="absolute top-8 left-8 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2">
                                        <Crosshair className="w-4 h-4"/> {t.zoneEnemy}
                                    </div>
                                    <div className="mt-8 grid grid-cols-10 gap-px bg-[#E6E1DC] border-2 border-[#1A1F26] rounded-xl overflow-hidden cursor-crosshair">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10;
                                            const y = Math.floor(i / 10);
                                            const { status } = getOpponentCellContent(x, y);
                                            return (
                                                <GridCell
                                                    key={i} x={x} y={y}
                                                    status={status}
                                                    onClick={() => isMyTurn && status === 'empty' && fireShot(x, y)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* LEFT COLUMN: MY BOARD + STATS */}
                            <div className="flex flex-col gap-6 lg:order-1 w-full max-w-xs mx-auto lg:mx-0">

                                {/* MY BOARD (STATUS) */}
                                <div className="bg-white p-5 rounded-[32px] shadow-lg border border-[#E6E1DC] opacity-90 hover:opacity-100 transition-opacity relative group">
                                    <div className="absolute top-5 left-5 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3"/> {t.zoneMe}</div>
                                    <div className="mt-8 grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC] w-fit mx-auto rounded overflow-hidden">
                                        {Array.from({ length: 100 }).map((_, i) => {
                                            const x = i % 10;
                                            const y = Math.floor(i / 10);
                                            const { status, shipPart } = getMyCellContent(x, y);
                                            return <GridCell key={i} x={x} y={y} status={status} shipPart={shipPart} size="small" />;
                                        })}
                                    </div>
                                </div>

                                {/* LIGHT STATS PANEL (FIXED COLOR) */}
                                <div className="bg-white border border-[#E6E1DC] p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-[#1A1F26] tracking-widest mb-2 relative z-10">
                                        <BarChart3 className="w-4 h-4 text-[#9e1316]" /> {t.stats}
                                    </div>

                                    <div className="space-y-4">
                                        {/* My Fleet Status */}
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-bold uppercase text-[#8A9099] mb-2">{t.zoneMe}</div>
                                            <FleetStatusList ships={myShips} isEnemy={false} />
                                        </div>

                                        <div className="h-px bg-[#F5F5F0] w-full" />

                                        {/* Enemy Fleet Status */}
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-bold uppercase text-[#8A9099] mb-2">{t.enemy}</div>
                                            <FleetStatusList ships={opponent?.ships || []} isEnemy={true} />
                                        </div>
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