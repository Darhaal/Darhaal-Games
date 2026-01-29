'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useBattleshipGame } from '@/hooks/useBattleshipGame';
import {
    Loader2, RotateCw, Trash2, Check, Shuffle,
    Crosshair, Anchor, Waves, Trophy, LogOut
} from 'lucide-react';
import { Ship, CellStatus, Coordinate, ShipType, FLEET_CONFIG } from '@/types/battleship';

// --- STYLES ---
const CELL_SIZE = "w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9"; // Responsive grid cells

// --- HELPERS ---
const getShipColor = (type: ShipType) => {
    switch (type) {
        case 'battleship': return 'bg-[#1A1F26]'; // Black
        case 'cruiser': return 'bg-[#4B5563]';    // Gray-600
        case 'destroyer': return 'bg-[#6B7280]';  // Gray-500
        case 'submarine': return 'bg-[#9CA3AF]';  // Gray-400
    }
};

const GridCell = ({
    x, y, status, shipPart, onClick, isHovered, hoverValid
}: {
    x: number; y: number;
    status: CellStatus;
    shipPart?: ShipType;
    onClick?: () => void;
    isHovered?: boolean;
    hoverValid?: boolean;
}) => {
    let content = null;
    let bgClass = "bg-[#F5F5F0]"; // Paper color default
    let borderClass = "border-[#E6E1DC]";

    // Rendering Logic
    if (status === 'miss') {
        content = <div className="w-2 h-2 rounded-full bg-[#8A9099]" />; // Grey dot
    } else if (status === 'hit') {
        bgClass = "bg-red-100";
        content = <div className="w-full h-full flex items-center justify-center text-[#9e1316] font-bold">✕</div>;
    } else if (status === 'killed') {
        bgClass = "bg-[#9e1316]";
        content = <SkullIcon className="w-4 h-4 text-white" />;
    } else if (shipPart) {
        bgClass = getShipColor(shipPart) + " shadow-sm border-white/20";
        borderClass = "border-transparent";
    }

    // Hover Effects (Placement)
    if (isHovered) {
        bgClass = hoverValid ? "bg-emerald-200" : "bg-red-200";
    }

    return (
        <div
            onClick={onClick}
            className={`
                ${CELL_SIZE} border ${borderClass} rounded-sm flex items-center justify-center
                transition-colors duration-150 relative select-none
                ${onClick ? 'cursor-pointer hover:brightness-95' : ''}
                ${bgClass}
            `}
        >
            {content}
        </div>
    );
};

const SkullIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="9" cy="12" r="1" />
        <circle cx="15" cy="12" r="1" />
        <path d="M8 20v2h8v-2" />
        <path d="M12.5 17l-.5-1-.5 1h1z" />
        <path d="M16 20a2 2 0 0 0 1.5-1.5l.5-4a7 7 0 1 0-12 0l.5 4A2 2 0 0 0 8 20" />
    </svg>
);

// --- MAIN COMPONENT ---

export default function BattleshipGame() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const lobbyId = searchParams.get('id');
    const [userId, setUserId] = useState<string>();

    // Setup State
    const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(null);
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [hoverPos, setHoverPos] = useState<Coordinate | null>(null);

    const {
        gameState, myShips, loading,
        initGame, autoPlaceShips, clearShips, placeShipManual, removeShip, submitShips,
        fireShot, leaveGame
    } = useBattleshipGame(lobbyId, userId);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    }, []);

    useEffect(() => {
        if (userId && gameState && !gameState.players?.[userId]) {
            initGame();
        }
    }, [userId, gameState]);

    // --- RENDER HELPERS ---

    const myBoard = userId && gameState?.players?.[userId];
    const opponentId = gameState && Object.keys(gameState.players).find(id => id !== userId);
    const opponentBoard = opponentId ? gameState.players[opponentId] : null;

    const isMyTurn = gameState?.turn === userId;
    const phase = gameState?.phase || 'loading';

    // Helper to see if a cell on MY board has a ship
    const getMyCellContent = (x: number, y: number) => {
        const ship = myShips.find(s => {
            if (s.orientation === 'horizontal') return s.position.y === y && x >= s.position.x && x < s.position.x + s.size;
            return s.position.x === x && y >= s.position.y && y < s.position.y + s.size;
        });

        // Show shots from enemy on my board
        if (opponentBoard && opponentBoard.shots[`${x},${y}`]) {
             return { status: opponentBoard.shots[`${x},${y}`], shipPart: ship?.type };
        }

        return { status: 'empty' as CellStatus, shipPart: ship?.type };
    };

    // Helper to see opponent board (Hide ships!)
    const getOpponentCellContent = (x: number, y: number) => {
        if (!myBoard) return { status: 'empty' as CellStatus };
        const shotStatus = myBoard.shots[`${x},${y}`];
        return { status: shotStatus || 'empty' };
    };

    // Placement logic
    const handleCellClick = (x: number, y: number) => {
        if (phase !== 'setup' || !selectedShipType) return;

        // Count how many we already placed
        const config = FLEET_CONFIG.find(c => c.type === selectedShipType)!;
        const currentCount = myShips.filter(s => s.type === selectedShipType).length;
        if (currentCount >= config.count) return;

        const newShip: Ship = {
            id: `${selectedShipType}-${Date.now()}`,
            type: selectedShipType,
            size: config.size,
            orientation,
            position: { x, y },
            hits: 0
        };

        const success = placeShipManual(newShip);
        if (success) {
            // Auto-deselect if we placed all of this type
            if (currentCount + 1 >= config.count) setSelectedShipType(null);
        }
    };

    const handleCellHover = (x: number, y: number) => setHoverPos({ x, y });
    const handleMouseLeave = () => setHoverPos(null);

    // Is placement valid for hover effect?
    const isHoverValid = (x: number, y: number) => {
        if (!selectedShipType || !hoverPos) return false;
        // Simple bounds check for hover visual only (real logic is in hook)
        const config = FLEET_CONFIG.find(c => c.type === selectedShipType)!;
        if (orientation === 'horizontal') {
            if (x + config.size > 10) return false;
        } else {
            if (y + config.size > 10) return false;
        }
        return true;
    };

    // Check if cell is part of the "phantom" ship during hover
    const isPhantomCell = (x: number, y: number) => {
        if (!hoverPos || !selectedShipType || phase !== 'setup') return false;
        const config = FLEET_CONFIG.find(c => c.type === selectedShipType)!;
        if (orientation === 'horizontal') {
             return y === hoverPos.y && x >= hoverPos.x && x < hoverPos.x + config.size;
        } else {
             return x === hoverPos.x && y >= hoverPos.y && y < hoverPos.y + config.size;
        }
    };


    if (loading || !gameState) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316]" /></div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

            {/* HEADER */}
            <header className="w-full max-w-6xl mx-auto p-4 flex justify-between items-center z-10 relative">
                <button onClick={() => { leaveGame(); router.push('/'); }}><LogOut className="w-5 h-5 text-gray-500" /></button>
                <div className="text-center">
                    <h1 className="font-black text-xl flex items-center gap-2 justify-center"><Anchor className="w-5 h-5 text-[#9e1316]"/> BATTLESHIP</h1>
                    <div className="text-[10px] font-bold text-[#9e1316] uppercase">
                        {phase === 'setup' && "DEPLOY YOUR FLEET"}
                        {phase === 'playing' && (isMyTurn ? "YOUR TURN TO FIRE" : "ENEMY TURN")}
                        {phase === 'finished' && "GAME OVER"}
                    </div>
                </div>
                <div className="w-8" />
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 gap-8 overflow-y-auto custom-scrollbar">

                {/* --- SETUP PHASE --- */}
                {phase === 'setup' && (
                    <div className="flex flex-col md:flex-row gap-8 items-start w-full max-w-4xl animate-in zoom-in-95">

                        {/* THE BOARD */}
                        <div className="bg-white p-4 rounded-xl shadow-xl border border-[#E6E1DC]">
                            <div className="grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC]">
                                {Array.from({ length: 100 }).map((_, i) => {
                                    const x = i % 10;
                                    const y = Math.floor(i / 10);
                                    const { shipPart } = getMyCellContent(x, y);
                                    const isPhantom = isPhantomCell(x, y);
                                    const valid = isHoverValid(x, y);

                                    return (
                                        <GridCell
                                            key={i} x={x} y={y}
                                            status={'empty'}
                                            shipPart={shipPart}
                                            onClick={() => handleCellClick(x, y)}
                                            isHovered={isPhantom}
                                            hoverValid={valid}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <button onClick={() => setOrientation(prev => prev === 'h' ? 'v' : 'h')} className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500 hover:text-[#1A1F26]">
                                    <RotateCw className="w-4 h-4" /> {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
                                </button>
                                <button onClick={clearShips} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>

                        {/* CONTROLS */}
                        <div className="flex-1 w-full space-y-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E1DC]">
                                <h3 className="text-sm font-black uppercase mb-4 text-[#8A9099]">Fleet Command</h3>
                                <div className="space-y-3">
                                    {FLEET_CONFIG.map(ship => {
                                        const placedCount = myShips.filter(s => s.type === ship.type).length;
                                        const isFull = placedCount >= ship.count;
                                        const isSelected = selectedShipType === ship.type;

                                        return (
                                            <button
                                                key={ship.type}
                                                onClick={() => !isFull && setSelectedShipType(ship.type)}
                                                disabled={isFull}
                                                className={`
                                                    w-full flex items-center justify-between p-3 rounded-xl border transition-all
                                                    ${isFull ? 'bg-gray-50 border-gray-100 opacity-50' : ''}
                                                    ${isSelected ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-md scale-105' : 'bg-white border-[#E6E1DC] hover:border-[#9e1316]'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-3 rounded-full ${isFull ? 'bg-gray-300' : 'bg-[#9e1316]'}`} style={{ width: ship.size * 8 }} />
                                                    <span className="text-xs font-bold uppercase">{ship.type}</span>
                                                </div>
                                                <span className="text-xs font-bold">{placedCount}/{ship.count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={autoPlaceShips} className="flex-1 py-3 bg-white border border-[#E6E1DC] rounded-xl font-bold text-xs uppercase hover:bg-gray-50 flex items-center justify-center gap-2">
                                    <Shuffle className="w-4 h-4" /> Auto
                                </button>
                                <button
                                    onClick={submitShips}
                                    disabled={myShips.length < 10 || myBoard?.isReady}
                                    className="flex-[2] py-3 bg-[#1A1F26] text-white rounded-xl font-bold text-xs uppercase hover:bg-[#9e1316] disabled:opacity-50 disabled:hover:bg-[#1A1F26] transition-colors shadow-lg flex items-center justify-center gap-2"
                                >
                                    {myBoard?.isReady ? 'Waiting for opponent...' : 'Deploy Fleet'} <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* --- PLAYING PHASE --- */}
                {phase === 'playing' && (
                    <div className="flex flex-col gap-6 items-center w-full max-w-5xl">

                        {/* ENEMY BOARD (BIG) */}
                        <div className="relative group">
                            <div className="absolute -top-8 left-0 right-0 text-center">
                                <span className={`text-xs font-black uppercase tracking-widest ${isMyTurn ? 'text-[#9e1316] animate-pulse' : 'text-gray-400'}`}>
                                    {isMyTurn ? 'RADAR ACTIVE - SELECT TARGET' : 'EVASIVE MANEUVERS'}
                                </span>
                            </div>

                            <div className={`bg-white p-4 rounded-xl shadow-2xl border-4 transition-all ${isMyTurn ? 'border-[#9e1316] shadow-[#9e1316]/20 scale-[1.02]' : 'border-[#E6E1DC]'}`}>
                                <div className="grid grid-cols-10 gap-px bg-[#E6E1DC] border border-[#E6E1DC] cursor-crosshair">
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

                        {/* MY BOARD (SMALL) */}
                        <div className="flex items-center gap-4 bg-white/80 backdrop-blur p-4 rounded-2xl border border-[#E6E1DC] shadow-sm mt-4">
                            <div className="w-32 h-32 md:w-40 md:h-40 relative opacity-90 hover:opacity-100 transition-opacity">
                                <div className="grid grid-cols-10 gap-px bg-gray-200 border border-gray-200 w-full h-full">
                                    {Array.from({ length: 100 }).map((_, i) => {
                                        const x = i % 10;
                                        const y = Math.floor(i / 10);
                                        const { status, shipPart } = getMyCellContent(x, y);
                                        // Miniature rendering
                                        let bg = "bg-[#F5F5F0]";
                                        if (status === 'hit') bg = "bg-red-400";
                                        else if (status === 'miss') bg = "bg-gray-300";
                                        else if (status === 'killed') bg = "bg-[#9e1316]";
                                        else if (shipPart) bg = "bg-[#1A1F26]";

                                        return <div key={i} className={`w-full h-full ${bg}`} />;
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-bold uppercase text-[#8A9099]">Fleet Status</div>
                                <div className="text-2xl font-black text-[#1A1F26]">{myBoard?.aliveShipsCount}/10</div>
                                <div className="h-px bg-[#E6E1DC] w-full" />
                                <div className="text-[10px] font-bold uppercase text-[#8A9099]">Enemy Ships</div>
                                <div className="text-2xl font-black text-[#9e1316]">{opponentBoard?.aliveShipsCount}/10</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FINISHED PHASE --- */}
                {phase === 'finished' && (
                     <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white p-10 rounded-[32px] text-center animate-in zoom-in duration-300 border-4 border-[#9e1316] shadow-2xl max-w-sm w-full">
                            <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-6 animate-bounce" />
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-2">WINNER</h2>
                            <p className="text-3xl font-black text-[#1A1F26] mb-8">
                                {gameState.winner === userId ? "YOU WON!" : "DEFEAT"}
                            </p>
                            <button
                                onClick={() => { leaveGame(); router.push('/'); }}
                                className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors shadow-lg"
                            >
                                Back to Menu
                            </button>
                        </div>
                     </div>
                )}

            </main>
        </div>
    );
}