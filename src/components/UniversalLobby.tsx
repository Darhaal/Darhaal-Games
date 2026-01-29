'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Crown, Copy, Check, Users, ScrollText, Ship, Bomb, Fingerprint, ShieldAlert, Skull, UserPlus, UserMinus, User, Play } from 'lucide-react';

// Универсальный интерфейс игрока для отображения в лобби
export interface LobbyPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  isReady?: boolean;
}

interface UniversalLobbyProps {
  roomCode: string;
  roomName: string;
  gameType: string;
  players: LobbyPlayer[];
  currentUserId: string | undefined;
  minPlayers: number;
  maxPlayers: number;
  onStart: () => void;
  onLeave: () => void;
  lang: 'ru' | 'en';
}

const GAME_ICONS: Record<string, any> = {
  coup: ScrollText,
  battleship: Ship,
  mafia: Users,
  minesweeper: Bomb,
  bunker: ShieldAlert,
  spyfall: Fingerprint,
  secret_hitler: Skull,
};

// Компонент уведомления (Toast)
const Toast = ({ msg, type }: { msg: string, type: 'join' | 'leave' }) => (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold uppercase tracking-wider animate-in slide-in-from-top-4 fade-in duration-300 z-[100] ${type === 'join' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
        {type === 'join' ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
        {msg}
    </div>
);

export default function UniversalLobby({
  roomCode,
  roomName,
  gameType,
  players,
  currentUserId,
  minPlayers,
  maxPlayers,
  onStart,
  onLeave,
  lang
}: UniversalLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; msg: string; type: 'join' | 'leave' }[]>([]);
  const prevPlayersRef = useRef<LobbyPlayer[]>(players);

  const isHost = players.find(p => p.id === currentUserId)?.isHost;
  const GameIcon = GAME_ICONS[gameType] || Users;

  const t = {
    ru: {
      waiting: 'Ожидание игроков...',
      start: 'Начать игру',
      leave: 'Покинуть',
      code: 'Код комнаты',
      copy: 'Скопировано',
      minPlayers: `Нужно ${minPlayers}+ игроков`,
      host: 'Хост',
      you: 'Вы',
      playersTitle: 'Игроки',
      joined: 'присоединился',
      left: 'вышел',
      ready: 'Готов'
    },
    en: {
      waiting: 'Waiting for players...',
      start: 'Start Game',
      leave: 'Leave',
      code: 'Room Code',
      copy: 'Copied',
      minPlayers: `Need ${minPlayers}+ players`,
      host: 'Host',
      you: 'You',
      playersTitle: 'Players',
      joined: 'joined',
      left: 'left',
      ready: 'Ready'
    }
  }[lang];

  // Логика уведомлений о входе/выходе
  useEffect(() => {
      const prev = prevPlayersRef.current;
      const current = players;

      // Кто зашел?
      current.forEach(p => {
          if (!prev.find(old => old.id === p.id)) {
              addNotification(`${p.name} ${t.joined}`, 'join');
          }
      });

      // Кто вышел?
      prev.forEach(p => {
          if (!current.find(newP => newP.id === p.id)) {
              addNotification(`${p.name} ${t.left}`, 'leave');
          }
      });

      prevPlayersRef.current = current;
  }, [players, t]);

  const addNotification = (msg: string, type: 'join' | 'leave') => {
      const id = Date.now();
      setNotifications(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      {/* Слой уведомлений */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
          {notifications.map(n => (
              <Toast key={n.id} msg={n.msg} type={n.type} />
          ))}
      </div>

      {/* HEADER */}
      <header className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center z-10 relative">
        <button
          onClick={onLeave}
          className="group flex items-center gap-2 px-4 py-2 bg-white border border-[#E6E1DC] rounded-xl hover:border-red-200 hover:bg-red-50 transition-all shadow-sm"
        >
            <LogOut className="w-4 h-4 text-[#8A9099] group-hover:text-[#9e1316] transition-colors" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#8A9099] group-hover:text-[#9e1316] hidden sm:block">{t.leave}</span>
        </button>

        <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
               <div className="p-2 bg-[#1A1F26] text-white rounded-lg shadow-md">
                 <GameIcon className="w-5 h-5" />
               </div>
               {roomName}
            </h1>
            <div className="text-[10px] font-bold text-[#9e1316] uppercase tracking-[0.2em] mt-2 bg-[#9e1316]/5 px-3 py-1 rounded-full border border-[#9e1316]/10 animate-pulse">
                {t.waiting}
            </div>
        </div>

        <div className="w-24 hidden sm:block" />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-start justify-center pt-8 lg:pt-16">

        {/* СПИСОК ИГРОКОВ */}
        <div className="w-full lg:w-2/3 bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-xl shadow-[#1A1F26]/5 relative overflow-hidden">
          <div className="flex justify-between items-center mb-8 border-b border-[#F5F5F0] pb-4">
              <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2 text-[#1A1F26]">
                  <Users className="w-5 h-5 text-[#9e1316]" />
                  {t.playersTitle} <span className="bg-[#F5F5F0] px-2 py-0.5 rounded-md text-base text-[#8A9099]">{players.length}/{maxPlayers}</span>
              </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map(p => (
              <div key={p.id} className="group relative bg-[#F8FAFC] p-4 rounded-2xl border border-[#E6E1DC] flex items-center gap-4 transition-all hover:border-[#9e1316]/30 hover:shadow-md hover:-translate-y-0.5">
                <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden bg-[#F5F5F0]">
                         {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400 m-auto mt-3" />}
                    </div>
                    {p.isHost && (
                        <div className="absolute -top-1 -right-1 bg-[#9e1316] text-white p-1 rounded-full border-2 border-white shadow-sm z-10" title={t.host}>
                            <Crown className="w-3 h-3" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col overflow-hidden">
                    <div className="font-black text-[#1A1F26] text-sm truncate">{p.name}</div>
                    <div className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider">
                        {p.id === currentUserId ? <span className="text-[#9e1316]">{t.you}</span> : (p.isHost ? t.host : 'Player')}
                    </div>
                </div>
              </div>
            ))}

            {/* Пустые слоты */}
            {Array.from({ length: Math.max(0, minPlayers - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="border-2 border-dashed border-[#E6E1DC] bg-transparent p-4 rounded-2xl flex items-center justify-center gap-4 opacity-50 min-h-[88px]">
                    <div className="w-14 h-14 rounded-full bg-[#E6E1DC]/30 animate-pulse" />
                    <div className="h-4 w-24 bg-[#E6E1DC]/30 rounded animate-pulse" />
                </div>
            ))}
          </div>
        </div>

        {/* САЙДБАР С КОДОМ И КНОПКОЙ */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">

            {/* Карточка кода */}
            <div
                onClick={handleCopy}
                className="bg-[#1A1F26] text-white p-8 rounded-[32px] shadow-2xl shadow-[#1A1F26]/20 text-center cursor-pointer group relative overflow-hidden transition-transform active:scale-[0.98]"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#9e1316]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 group-hover:text-white/80 transition-colors">{t.code}</div>
                    <div className="text-5xl font-black tracking-widest font-mono group-hover:scale-110 transition-transform duration-300">
                        {roomCode}
                    </div>

                    <div className={`absolute top-4 right-4 transition-all duration-300 ${copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                        <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                            <Check className="w-4 h-4" />
                        </div>
                    </div>
                    <div className={`absolute top-4 right-4 transition-all duration-300 ${!copied ? 'opacity-0 group-hover:opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                        <Copy className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Кнопка Старта */}
            {isHost ? (
                <button
                    onClick={onStart}
                    disabled={players.length < minPlayers}
                    className="w-full py-5 bg-white border-2 border-[#1A1F26] text-[#1A1F26] rounded-[24px] font-black uppercase tracking-[0.15em] text-sm hover:bg-[#1A1F26] hover:text-white hover:shadow-xl hover:shadow-[#1A1F26]/20 disabled:opacity-50 disabled:hover:bg-white disabled:hover:text-[#1A1F26] disabled:cursor-not-allowed transition-all active:translate-y-1 flex items-center justify-center gap-3"
                >
                    {players.length < minPlayers ? t.minPlayers : <><Play className="w-4 h-4" /> {t.start}</>}
                </button>
            ) : (
                <div className="w-full py-5 bg-[#F5F5F0] border border-[#E6E1DC] text-[#8A9099] rounded-[24px] font-bold uppercase tracking-widest text-xs text-center flex items-center justify-center gap-3">
                    <div className="w-2 h-2 bg-[#9e1316] rounded-full animate-bounce" />
                    {t.waiting}
                    <div className="w-2 h-2 bg-[#9e1316] rounded-full animate-bounce delay-75" />
                </div>
            )}

            <div className="px-4 text-center">
                <p className="text-[10px] text-[#8A9099] font-bold uppercase tracking-wider leading-relaxed">
                    Поделитесь кодом с друзьями
                </p>
            </div>
        </div>

      </main>
    </div>
  );
}