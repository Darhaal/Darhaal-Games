'use client';

import React, { useState, useEffect } from 'react';
import {
    Loader2, RotateCw, Trash2, Check, Shuffle,
    Anchor, Trophy, LogOut, Timer, Crosshair, Map, Shield
} from 'lucide-react';
import { Ship, CellStatus, Coordinate, ShipType, FLEET_CONFIG } from '@/types/battleship';

const CELL_SIZE_L = "w-8 h-8 sm:w-10 sm:h-10";
const CELL_SIZE_S = "w-4 h-4 sm:w-5 sm:h-5";

const DICTIONARY = {
    ru: {
        deployment: 'РАЗВЕРТЫВАНИЕ',
        yourTurn: 'ВАШ ХОД',
        enemyTurn: 'ХОД ПРОТИВНИКА',
        fleet: 'ДОСТУПНЫЙ ФЛОТ',
        auto: 'АВТО',
        ready: 'В БОЙ!',
        waiting: 'ОЖИДАНИЕ...',
        victory: 'ПОБЕДА',
        defeat: 'ПОРАЖЕНИЕ',
        winMsg: 'ВЫ ПОБЕДИЛИ!',
        loseMsg: 'ФЛОТ УНИЧТОЖЕН',
        menu: 'В МЕНЮ',
        zoneEnemy: 'ЗОНА ПРОТИВНИКА',
        zoneMe: 'МОЙ ФЛОТ',
        shipsAlive: 'КОРАБЛИ В СТРОЮ',
        enemy: 'ВРАГ',
        horizontal: 'ГОРИЗОНТАЛЬНО',
        vertical: 'ВЕРТИКАЛЬНО',
        dragHint: 'Перетащите корабли на поле. Q/E для поворота.',
        hint: 'Кликните чтобы поставить или перетащить.'
    },
    en: {
        deployment: 'DEPLOYMENT',
        yourTurn: 'YOUR TURN',
        enemyTurn: 'ENEMY TURN',
        fleet: 'AVAILABLE FLEET',
        auto: 'AUTO',
        ready: 'BATTLE!',
        waiting: 'WAITING...',
        victory: 'VICTORY',
        defeat: 'DEFEAT',
        winMsg: 'YOU WON!',
        loseMsg: 'FLEET DESTROYED',
        menu: 'MENU',
        zoneEnemy: 'ENEMY ZONE',
        zoneMe: 'MY FLEET',
        shipsAlive: 'SHIPS ACTIVE',
        enemy: 'ENEMY',
        horizontal: 'HORIZONTAL',
        vertical: 'VERTICAL',
        dragHint: 'Drag ships to grid. Press Q/E to rotate.',
        hint: 'Click to place or drag to move.'
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

const GridCell = ({
    x, y, status, shipPart, onClick, onMouseEnter, onContextMenu, onDrop, onDragOver, onDragStart, isHovered, hoverValid, size = 'large'
}: any) => {
    const isSmall = size === 'small';
    let content = null;

    let bgClass = "bg-[#F5F5F0]";
    let borderClass = isSmall ? "border-[0.5px] border-[#E6E1DC]" : "border border-[#E6E1DC]";

    if (status === 'miss') {
        content = <div className={`${isSmall ? 'w-1 h-1' : 'w-2 h-2'} rounded-full bg-[#8A9099]/60`} />;
    } else if (status === 'hit') {
        bgClass = "bg-red-50";
        content = <span className={`${isSmall ? 'text-[10px]' : 'text-lg'} text-[#9e1316] font-bold font-mono`}>X</span>;
    } else if (status === 'killed') {
        bgClass = "bg-[#9e1316]";
        content = <span className={`${isSmall ? 'text-[8px]' : 'text-sm'} text-white font-bold`}>☠</span>;
    } else if (shipPart) {
        bgClass = getShipColor(shipPart) + " shadow-sm border-white/20";
        borderClass = "border-transparent";
    }

    if (isHovered) {
        bgClass = hoverValid ? "bg-emerald-200" : "bg-red-200";
    }

    const cursorClass = onClick && status === 'empty' ? 'cursor-crosshair hover:bg-gray-100' : 'cursor-default';
    const draggable = !!shipPart && !isSmall;

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
                flex items-center justify-center transition-colors duration-150 select-none
            `}
        >
            {content}
        </div>
    );
};

export default function BattleshipGame({
    gameState, userId, myShips, autoPlaceShips, clearShips,
    placeShipManual, removeShip, submitShips, fireShot, leaveGame, lang
}: any) {
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [selectedType, setSelectedType] = useState<ShipType | null>(null);
    const [hoverPos, setHoverPos] = useState<Coordinate | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);
    // Для перетаскивания уже поставленных
    const [movingShip, setMovingShip] = useState<Ship | null>(null);

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

    // KEYBOARD ROTATION
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'q' || e.key === 'e' || e.key === 'r') {
                setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const getMyCellContent = (x: number, y: number) => {
        const s = myShips.find((s: Ship) =>
            s.orientation === 'horizontal'
                ? (s.position.y === y && x >= s.position.x && x < s.position.x + s.size)
                : (s.position.x === x && y >= s.position.y && y < s.position.y + s.size)
        );
        const shot = phase === 'playing' && me?.shots ? me.shots[`${x},${y}`] : null;
        return { status: shot || 'empty', shipPart: s?.type, ship: s };
    };

    const getOpponentCellContent = (x: number, y: number) => {
        const shot = me?.shots[`${x},${y}`];
        return { status: shot || 'empty' };
    };

    // --- PLACEMENT LOGIC ---

    const tryPlaceShip = (x: number, y: number, type: ShipType, shipId?: string) => {
        const config = FLEET_CONFIG.find(c => c.type === type);
        if (!config) return;

        // Если это новый корабль, проверяем лимит
        if (!shipId) {
            const currentCount = myShips.filter((s: Ship) => s.type === type).length;
            if (currentCount >= config.count) return;
        }

        const newShip = {
            id: shipId || `${type}-${Date.now()}`,
            type: type,
            size: config.size,
            orientation,
            position: { x, y },
            hits: 0
        };

        const success = placeShipManual(newShip);

        // Если успех и это новый корабль - сбрасываем выбор, если лимит исчерпан
        if (success && !shipId) {
             const newCount = myShips.filter((s: Ship) => s.type === type).length + 1;
             if (newCount >= config.count) setSelectedType(null);
        }

        setMovingShip(null);
    };

    const handleSetupClick = (x: number, y: number) => {
        // Если кликнули по пустому месту с выбранным типом - ставим
        if (selectedType) {
            tryPlaceShip(x, y, selectedType);
            return;
        }

        // Если кликнули по существующему кораблю - берем его (удаляем и выбираем тип)
        const { ship } = getMyCellContent(x, y);
        if (ship) {
            removeShip(ship.id);
            setSelectedType(ship.type);
            setOrientation(ship.orientation);
            setHoverPos({ x, y }); // Сразу показываем призрак
        }
    };

    // --- DRAG AND DROP ---

    const handleDragStartFromMenu = (e: React.DragEvent, type: ShipType) => {
        setSelectedType(type);
        e.dataTransfer.setData('shipType', type);
    };

    const handleDragStartFromBoard = (e: React.DragEvent, ship: Ship) => {
        setMovingShip(ship);
        setSelectedType(ship.type);
        setOrientation(ship.orientation);
        e.dataTransfer.setData('shipId', ship.id);
        e.dataTransfer.setData('shipType', ship.type);
        // Не удаляем сразу, только при успешном дропе
    };

    const handleDrop = (e: React.DragEvent, x: number, y: number) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('shipType') as ShipType;
        const id = e.dataTransfer.getData('shipId'); // Может быть пустым

        if (type) tryPlaceShip(x, y, type, id || undefined);
    };

    const handleDragOver = (e: React.DragEvent, x: number, y: number) => {
        e.preventDefault();
        setHoverPos({ x, y });
    };

    const isHoverValid = (x: number, y: number) => {
        if (!selectedType || !hoverPos) return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedType)!;
        if (orientation === 'horizontal') return x + config.size <= 10;
        return y + config.size <= 10;
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

    if (phase === 'finished') return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
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
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

            <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
                <button onClick={leaveGame} className="p-2 text-gray-400 hover:text-[#9e1316] transition-colors"><LogOut className="w-5 h-5" /></button>
                <div className="text-center">
                    <h1 className="font-black text-xl flex items-center gap-2 justify-center text-[#1A1F26]">
                        <Anchor className="w-5 h-5 text-[#9e1316]"/> BATTLESHIP
                    </h1>
                    <div className="text-[10px] font-bold text-[#9e1316] uppercase flex items-center gap-2 justify-center mt-1">
                        {phase === 'setup' ? t.deployment : (isMyTurn ? t.yourTurn : t.enemyTurn)}
                        {phase === 'playing' && <span className={`flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#E6E1DC] ${timeLeft < 15 ? 'text-red-600 animate-pulse' : ''}`}><Timer className="w-3 h-3"/> {timeLeft}s</span>}
                    </div>
                </div>
                <div className="w-8" />
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-6 overflow-y-auto custom-scrollbar w-full">

                {phase === 'setup' && (
                    <div className="flex flex-col lg:flex-row gap-8 items-start w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4">

                        <div className="bg-white p-6 rounded-[32px] shadow-xl border border-[#E6E1DC] relative mx-auto lg:mx-0">
                            <div className="absolute -top-3 left-6 bg-[#9e1316] text-white text-[10px] font-bold uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">
                                {t.deployment}
                            </div>
                            <div
                                className="grid grid-cols-10 gap-px bg-[#E6E1DC] border-2 border-[#1A1F26] overflow-hidden rounded-lg cursor-crosshair"
                                onMouseLeave={() => setHoverPos(null)}
                            >
                                {Array.from({ length: 100 }).map((_, i) => {
                                    const x = i % 10;
                                    const y = Math.floor(i / 10);
                                    const { shipPart, ship } = getMyCellContent(x, y);
                                    return (
                                        <GridCell
                                            key={i} x={x} y={y}
                                            status={'empty'}
                                            shipPart={shipPart}
                                            onClick={() => handleSetupClick(x, y)}
                                            onMouseEnter={() => setHoverPos({x, y})}
                                            onDrop={(e: any) => handleDrop(e, x, y)}
                                            onDragOver={(e: any) => handleDragOver(e, x, y)}
                                            onDragStart={(e: any) => ship && handleDragStartFromBoard(e, ship)}
                                            onContextMenu={(e: any) => {
                                                e.preventDefault();
                                                setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
                                            }}
                                            isHovered={isPhantomCell(x, y)}
                                            hoverValid={isHoverValid(x, y)}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between items-center mt-4 px-2">
                                <button onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className="flex items-center gap-2 text-xs font-bold uppercase text-[#1A1F26] hover:text-[#9e1316] transition-colors bg-[#F5F5F0] px-3 py-2 rounded-lg border border-[#E6E1DC]">
                                    <RotateCw className={`w-4 h-4 transition-transform ${orientation === 'vertical' ? 'rotate-90' : ''}`} />
                                    {t[orientation]}
                                </button>
                                <div className="text-[9px] text-gray-400 font-bold uppercase mx-auto px-4">{t.dragHint}</div>
                                <button onClick={clearShips} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>

                        <div className="flex-1 w-full space-y-4">
                            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-[#E6E1DC]">
                                <h3 className="text-xs font-black uppercase mb-4 text-[#8A9099] flex items-center gap-2"><Map className="w-4 h-4"/> {t.fleet}</h3>
                                <div className="space-y-2">
                                    {FLEET_CONFIG.map(ship => {
                                        const placedCount = myShips.filter((s: Ship) => s.type === ship.type).length;
                                        const isFull = placedCount >= ship.count;
                                        const isSelected = selectedType === ship.type;

                                        return (
                                            <button
                                                key={ship.type}
                                                draggable={!isFull}
                                                onDragStart={(e) => handleDragStartFromMenu(e, ship.type)}
                                                onClick={() => !isFull && setSelectedType(ship.type)}
                                                disabled={isFull}
                                                className={`
                                                    w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200 cursor-grab active:cursor-grabbing
                                                    ${isFull ? 'bg-gray-50 border-transparent opacity-40 grayscale cursor-default' : ''}
                                                    ${isSelected ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-lg scale-[1.02]' : 'bg-white border-[#F5F5F0] hover:border-[#E6E1DC]'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-2 rounded-full ${isFull ? 'bg-gray-400' : (isSelected ? 'bg-[#9e1316]' : 'bg-[#1A1F26]')}`} style={{ width: ship.size * 10 }} />
                                                    <span className="text-[10px] font-bold uppercase">{ship.type}</span>
                                                </div>
                                                <span className="text-xs font-black">{placedCount}/{ship.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={autoPlaceShips} className="flex-1 py-4 bg-white border-2 border-[#E6E1DC] text-[#1A1F26] rounded-xl font-bold text-xs uppercase hover:bg-gray-50 hover:border-gray-300 flex items-center justify-center gap-2 transition-all">
                                    <Shuffle className="w-4 h-4" /> {t.auto}
                                </button>
                                <button
                                    onClick={submitShips}
                                    disabled={myShips.length < 10 || me?.isReady}
                                    className="flex-[2] py-4 bg-[#1A1F26] text-white rounded-xl font-black text-xs uppercase hover:bg-[#9e1316] disabled:opacity-50 disabled:hover:bg-[#1A1F26] transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                                >
                                    {me?.isReady ? t.waiting : t.ready} <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- BATTLE UI --- */}
                {phase === 'playing' && (
                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-center w-full max-w-6xl animate-in fade-in">

                        <div className="relative group order-1 md:order-2">
                            <div className="absolute -top-10 left-0 right-0 text-center">
                                <span className={`text-xs font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full bg-white shadow-sm border border-[#E6E1DC] ${isMyTurn ? 'text-[#9e1316] border-[#9e1316]' : 'text-gray-400'}`}>
                                    {isMyTurn ? t.yourTurn : t.enemyTurn}
                                </span>
                            </div>

                            <div className={`bg-white p-4 sm:p-6 rounded-[32px] shadow-2xl border-4 transition-all duration-500 relative ${isMyTurn ? 'border-[#9e1316] shadow-[#9e1316]/20 scale-[1.02] z-20' : 'border-[#E6E1DC] opacity-90 grayscale-[0.5] scale-95'}`}>
                                <div className="absolute top-6 left-6 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Crosshair className="w-4 h-4"/> {t.zoneEnemy}</div>
                                <div className="mt-8 grid grid-cols-10 gap-px bg-[#E6E1DC] border-2 border-[#1A1F26] rounded-lg overflow-hidden cursor-crosshair">
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

                        <div className="flex flex-col gap-4 order-2 md:order-1">
                            <div className="bg-white p-4 rounded-[24px] shadow-md border border-[#E6E1DC] opacity-90 hover:opacity-100 transition-opacity relative">
                                <div className="absolute top-4 left-4 text-[10px] font-bold text-[#8A9099] uppercase tracking-widest flex items-center gap-2"><Shield className="w-3 h-3"/> {t.zoneMe}</div>
                                <div className="mt-6 grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC] w-fit mx-auto rounded overflow-hidden">
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10;
                                        const y = Math.floor(i / 10);
                                        const { status, shipPart } = getMyCellContent(x, y);
                                        return <GridCell key={i} x={x} y={y} status={status} shipPart={shipPart} size="small" />;
                                    })}
                                </div>
                            </div>

                            <div className="bg-[#1A1F26] text-white p-6 rounded-[24px] shadow-lg flex flex-col gap-3">
                                <div className="flex justify-between items-end">
                                    <div className="text-[10px] font-bold uppercase text-gray-400">{t.shipsAlive}</div>
                                    <div className="text-2xl font-black">{me?.aliveShipsCount}/10</div>
                                </div>
                                <div className="h-px bg-white/20 w-full" />
                                <div className="flex justify-between items-end">
                                    <div className="text-[10px] font-bold uppercase text-[#9e1316]">{t.enemy}</div>
                                    <div className="text-xl font-bold text-[#9e1316]">{opponent?.aliveShipsCount}/10</div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </main>
        </div>
    );
}