'use client';

import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Crown, Copy, Check, Users, User, Play,
  Wifi, WifiOff, XCircle, Link as LinkIcon
} from 'lucide-react';
import { getGame } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useLobbyTouch } from '@/hooks/useLobbyTouch';
import { track } from '@/lib/analytics';
import { GA_EVENTS } from '@/constants/analytics';
import { supabase } from '@/lib/supabase';
import { writeGameState } from '@/lib/gameStateSync';
import { playSfx } from '@/lib/sound';

export interface LobbyPlayer {
  id: string;
  name: string;
  avatarUrl: string;
  isHost: boolean;
  isReady?: boolean;
}

interface UniversalLobbyProps {
  /** Needed for the keep-alive ping; the room is addressed by id, not code. */
  lobbyId: string | null;
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

const Toast = ({ msg, type }: { msg: string, type: 'join' | 'leave' | 'info' }) => (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold uppercase tracking-wider animate-in slide-in-from-top-4 fade-in duration-300 z-[100] ${type === 'join' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : type === 'leave' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
        {msg}
    </div>
);

export default function UniversalLobby({
  lobbyId,
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; msg: string; type: 'join' | 'leave' | 'info' }[]>([]);
  const prevPlayersRef = useRef<LobbyPlayer[]>(players);

  // Timers tracking offline players before auto-kick (id -> removal timestamp)
  const [kickTimers, setKickTimers] = useState<Record<string, number>>({});
  // Clock tick for the countdown display (avoids calling Date.now() during render)
  const [nowTick, setNowTick] = useState(0);

  // Presence connection
  const { onlineUserIds, isSynced } = usePresenceHeartbeat(roomCode, currentUserId);

  // Tells the database somebody is still here. Presence alone is invisible to
  // the cleanup job, so a room whose last tab closed used to linger for days.
  useLobbyTouch(lobbyId, !!currentUserId);

  const isHost = players.find(p => p.id === currentUserId)?.isHost;
  const game = getGame(gameType);
  const GameIcon = game ? GAME_ICONS[game.id] : Users;

  const addNotification = (msg: string, type: 'join' | 'leave' | 'info') => {
      playSfx('notify');
      const id = Date.now();
      setNotifications(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const t = {
    ru: {
      waiting: 'Ожидание игроков...',
      start: 'Начать игру',
      leave: 'Покинуть',
      code: 'Код комнаты',
      copyLink: 'Скопировать ссылку',
      linkCopied: 'Ссылка скопирована',
      minPlayers: `Нужно ${minPlayers}+ игроков`,
      host: 'Хост',
      you: 'Вы',
      playersTitle: 'Игроки',
      joined: 'присоединился',
      left: 'вышел',
      offline: 'Не в сети',
      kick: 'Исключить',
      kicked: 'Игрок исключен',
      autoKick: 'Кик через',
      sec: 'с'
    },
    en: {
      waiting: 'Waiting for players...',
      start: 'Start Game',
      leave: 'Leave',
      code: 'Room Code',
      copyLink: 'Copy invite link',
      linkCopied: 'Link copied',
      minPlayers: `Need ${minPlayers}+ players`,
      host: 'Host',
      you: 'You',
      playersTitle: 'Players',
      joined: 'joined',
      left: 'left',
      offline: 'Offline',
      kick: 'Kick',
      kicked: 'Player kicked',
      autoKick: 'Kick in',
      sec: 's'
    }
  }[lang];

  // Join/leave notifications (visual)
  useEffect(() => {
      const prev = prevPlayersRef.current;
      const current = players;

      current.forEach(p => {
          if (!prev.find(old => old.id === p.id)) {
              addNotification(`${p.name} ${t.joined}`, 'join');
          }
      });

      prev.forEach(p => {
          if (!current.find(newP => newP.id === p.id)) {
              addNotification(`${p.name} ${t.left}`, 'leave');
          }
      });

      prevPlayersRef.current = current;
  }, [players, t]);

  /**
   * Copies text, falling back when the async clipboard is unavailable.
   *
   * The fallback used to be reached only when `navigator.clipboard` was
   * missing entirely. It is usually present but *denied* — an insecure
   * context, a permissions policy, an in-app browser — and then the write
   * rejects, the error was swallowed and the button gave no feedback at all.
   * So the fallback now runs on rejection too, not only on absence.
   */
  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Denied rather than absent — drop through to the legacy path.
      }
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textArea);
      return ok;
    } catch (err) {
      console.error('Copy failed', err);
      return false;
    }
  };

  const handleCopy = async () => {
    if (await copyText(roomCode)) setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Copies the invite link rather than the code.
   *
   * This screen's own URL is already `/game/<type>?id=<lobby>`, which is
   * exactly what a friend needs to open — so there is nothing to assemble and
   * nothing that can drift out of step with the route.
   */
  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    if (await copyText(window.location.href)) setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  /** The one button that starts a match, whichever game it is. */
  const handleStart = () => {
    track(GA_EVENTS.matchStarted, { game: gameType, players: players.length });
    onStart();
  };

  const handleKickPlayer = async (targetId: string) => {
    if (!isHost) return;

    try {
      // 1. Fetch the FRESH state from the DB (critical to avoid remove-then-restore races)
      const { data, error } = await supabase
        .from('lobbies')
        .select('id, game_state')
        .eq('code', roomCode)
        .single();

      if (error || !data) return;

      const currentState = data.game_state as { players: LobbyPlayer[] | Record<string, LobbyPlayer>; version?: number } & Record<string, unknown>;
      let newPlayers = currentState.players;
      let playersCount = 0;

      // 2. Remove the player according to the data shape
      if (Array.isArray(newPlayers)) {
        // Array (Spyfall, Coup, Flager)
        newPlayers = newPlayers.filter((p) => p.id !== targetId);
        playersCount = newPlayers.length;
      } else if (typeof newPlayers === 'object') {
        // Record (Battleship, Minesweeper)
        const updatedPlayers = { ...newPlayers };
        delete updatedPlayers[targetId];
        newPlayers = updatedPlayers;
        playersCount = Object.keys(newPlayers).length;
      }

      // 3. If no players remain — delete the lobby, otherwise update it
      if (playersCount === 0) {
          // Deletion goes through leave_lobby (SECURITY DEFINER): the table
          // grants no delete privilege to clients.
          await supabase.rpc('leave_lobby', { p_lobby_id: data.id });
          onLeave(); // Leave ourselves since the lobby is destroyed
      } else {
          // CAS write through the shared helper (protects against racing writes)
          await writeGameState(data.id as string, {
              ...currentState,
              players: newPlayers,
              version: (currentState.version || 0) + 1
          });

          // Local notification only for a manual kick (not auto)
          if (!kickTimers[targetId]) {
             addNotification(t.kicked, 'info');
          }
      }

    } catch (e) {
      console.error("Kick failed", e);
    }
  };

  /**
   * Takes the room over when the host has gone.
   *
   * The auto-kick below is run by the host and never kicks itself, so an
   * absent host left the room frozen: nobody to remove the ghosts, and no
   * "start" button for anyone. The remaining players now promote one of
   * their own.
   *
   * `handleKickPlayer` deliberately does not promote anyone — it was written
   * for a host removing someone else, where the host stays. Promoting has to
   * happen in the same write as the removal, or the room spends a moment with
   * no host at all and every client tries to fix it at once.
   */
  const handleHostGone = async (absentHostId: string) => {
    try {
      const { data, error } = await supabase
        .from('lobbies')
        .select('id, game_state')
        .eq('code', roomCode)
        .single();

      if (error || !data) return;

      const state = data.game_state as {
        players: LobbyPlayer[] | Record<string, LobbyPlayer>;
        version?: number;
      } & Record<string, unknown>;

      // Someone else got there first, or the host came back.
      const stillHost = Array.isArray(state.players)
        ? state.players.some((p) => p.id === absentHostId && p.isHost)
        : state.players?.[absentHostId]?.isHost;
      if (!stillHost) return;

      let players: LobbyPlayer[] | Record<string, LobbyPlayer>;
      let remaining: LobbyPlayer[];

      if (Array.isArray(state.players)) {
        remaining = state.players.filter((p) => p.id !== absentHostId);
        players = remaining;
      } else {
        const rest = { ...state.players };
        delete rest[absentHostId];
        remaining = Object.values(rest);
        players = rest;
      }

      if (remaining.length === 0) {
        await supabase.rpc('leave_lobby', { p_lobby_id: data.id });
        onLeave();
        return;
      }

      // Prefer somebody who is actually here; fall back to roster order so
      // two clients deciding at once still pick the same person.
      const heir = remaining.find((p) => onlineUserIds.includes(p.id)) || remaining[0];
      heir.isHost = true;

      await writeGameState(data.id as string, {
        ...state,
        players,
        version: (state.version || 0) + 1
      });
    } catch (e) {
      console.error('Host handover failed', e);
    }
  };

  // --- HOST HANDOVER: the room outlives whoever opened it ---
  useEffect(() => {
    if (!isSynced || !currentUserId) return;

    const host = players.find((p) => p.isHost);
    if (!host || host.id === currentUserId) return;          // we are fine, or we are it
    if (onlineUserIds.includes(host.id)) return;             // host is here

    // One client acts. The first player present, in roster order, excluding
    // the host we are about to remove — everyone computes the same answer.
    const actor = players.find((p) => p.id !== host.id && onlineUserIds.includes(p.id));
    if (actor?.id !== currentUserId) return;

    // Longer than the ten seconds a player gets: losing the host reassigns
    // control of the room, so a reload should not be enough to trigger it.
    const timer = setTimeout(() => handleHostGone(host.id), 15000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleHostGone reads fresh state itself; listing it would restart the timer every render
  }, [isSynced, currentUserId, players, onlineUserIds]);

  // --- AUTO-KICK SYSTEM (runs on the host only) ---
  useEffect(() => {
    // Only run when we are the host and Presence has synced
    if (!isHost || !isSynced) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      const newTimers = { ...kickTimers };
      let changed = false;

      players.forEach(p => {
        if (p.id === currentUserId) return; // Never kick ourselves

        // Is the player offline?
        const isOffline = !onlineUserIds.includes(p.id);

        if (isOffline) {
          if (!newTimers[p.id]) {
            // Start the timer (10 seconds to reconnect)
            newTimers[p.id] = now + 10000;
            changed = true;
          } else if (now > newTimers[p.id]) {
            // Time is up — kick
            handleKickPlayer(p.id);
            delete newTimers[p.id]; // Drop the timer so we do not spam requests
            changed = true;
          }
        } else {
          // Player is online — clear the timer if any
          if (newTimers[p.id]) {
            delete newTimers[p.id];
            changed = true;
          }
        }
      });

      // Clean up timers for players no longer in the list
      Object.keys(newTimers).forEach(id => {
        if (!players.find(p => p.id === id)) {
          delete newTimers[id];
          changed = true;
        }
      });

      if (changed) setKickTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the interval reads currentUserId/handleKickPlayer via a fresh closure; adding them would recreate the interval each tick
  }, [isHost, isSynced, players, onlineUserIds, kickTimers]);


  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
          {notifications.map(n => (
              <Toast key={n.id} msg={n.msg} type={n.type} />
          ))}
      </div>

      <header className="w-full max-w-6xl mx-auto p-6 flex justify-between items-center z-10 relative">
        <button onClick={onLeave} className="group flex items-center gap-2 px-4 py-2 bg-white border border-[#E6E1DC] rounded-xl hover:border-red-200 hover:bg-red-50 transition-all shadow-sm">
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
            <div className="flex items-center gap-2 mt-2">
                <div className="text-2xs font-bold text-[#9e1316] uppercase tracking-[0.2em] bg-[#9e1316]/5 px-3 py-1 rounded-full border border-[#9e1316]/10 animate-pulse">
                    {t.waiting}
                </div>
            </div>
        </div>

        <div className="w-24 hidden sm:block" />
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 z-10 flex flex-col lg:flex-row gap-8 items-start justify-center pt-8 lg:pt-16">
        <div className="w-full lg:w-2/3 bg-white border border-[#E6E1DC] rounded-[32px] p-8 shadow-xl shadow-[#1A1F26]/5 relative overflow-hidden transition-all">
          <div className="flex justify-between items-center mb-8 border-b border-[#F5F5F0] pb-4">
              <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2 text-[#1A1F26]">
                  <Users className="w-5 h-5 text-[#9e1316]" />
                  {t.playersTitle} <span className="bg-[#F5F5F0] px-2 py-0.5 rounded-md text-base text-[#8A9099]">{players.length}/{maxPlayers}</span>
              </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {players.map(p => {
              // A player is online if present in Presence, or if it is me (while sync is in progress)
              const isOnline = !isSynced || onlineUserIds.includes(p.id) || p.id === currentUserId;
              const isMe = p.id === currentUserId;

              // Time until kick (if the timer is running)
              const kickTime = kickTimers[p.id] && nowTick ? Math.ceil((kickTimers[p.id] - nowTick) / 1000) : null;

              return (
                <div key={p.id} className={`group relative p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${isOnline ? 'bg-[#F8FAFC] border-[#E6E1DC] hover:border-[#9e1316]/30 hover:shadow-md' : 'bg-red-50 border-red-100 opacity-90'}`}>
                  <div className="flex items-center gap-4 min-w-0">
                      <div className="relative">
                          <div className="w-14 h-14 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden bg-[#F5F5F0]">
                              {p.avatarUrl ? <Image src={p.avatarUrl} alt={p.name} width={56} height={56} className={`w-full h-full object-cover ${!isOnline ? 'grayscale' : ''}`} /> : <User className="w-8 h-8 text-gray-400 m-auto mt-3" />}
                          </div>
                          {p.isHost && (
                              <div className="absolute -top-1 -right-1 bg-[#9e1316] text-white p-1 rounded-full border-2 border-white shadow-sm z-10" title={t.host}>
                                  <Crown className="w-3 h-3" />
                              </div>
                          )}
                          <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white shadow-sm z-10 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}>
                              {isOnline ? <Wifi className="w-2.5 h-2.5 text-white" /> : <WifiOff className="w-2.5 h-2.5 text-white" />}
                          </div>
                      </div>

                      <div className="flex flex-col overflow-hidden">
                          <div className="font-black text-[#1A1F26] text-sm truncate">{p.name}</div>
                          <div className="flex items-center gap-2">
                            <div className="text-2xs font-bold text-[#8A9099] uppercase tracking-wider">
                                {isMe ? <span className="text-[#9e1316]">{t.you}</span> : (p.isHost ? t.host : 'Player')}
                            </div>
                            {!isOnline && (
                                <span className="text-3xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                    {kickTime !== null && kickTime > 0 ? `${t.autoKick} ${kickTime}${t.sec}` : t.offline}
                                </span>
                            )}
                          </div>
                      </div>
                  </div>

                  {/* Kick button: host only, never for yourself */}
                  {isHost && !isMe && (
                      <button
                        onClick={() => handleKickPlayer(p.id)}
                        className="p-2 bg-white rounded-xl border border-transparent hover:border-red-200 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm"
                        title={t.kick}
                      >
                          <XCircle className="w-5 h-5" />
                      </button>
                  )}
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, minPlayers - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="border-2 border-dashed border-[#E6E1DC] bg-transparent p-4 rounded-2xl flex items-center justify-center gap-4 opacity-50 min-h-[88px]">
                    <div className="w-14 h-14 rounded-full bg-[#E6E1DC]/30 animate-pulse" />
                    <div className="h-4 w-24 bg-[#E6E1DC]/30 rounded animate-pulse" />
                </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div
                onClick={handleCopy}
                className="bg-[#1A1F26] text-white p-8 rounded-[32px] shadow-2xl shadow-[#1A1F26]/20 text-center cursor-pointer group relative overflow-hidden transition-transform active:scale-[0.98]"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#9e1316]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                    <div className="text-2xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4 group-hover:text-white/80 transition-colors">{t.code}</div>
                    <div className="text-5xl font-black tracking-widest font-mono group-hover:scale-110 transition-transform duration-300">
                        {roomCode}
                    </div>
                    <div className={`absolute top-4 right-4 transition-all duration-300 ${copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                        <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg"><Check className="w-4 h-4" /></div>
                    </div>
                    <div className={`absolute top-4 right-4 transition-all duration-300 ${!copied ? 'opacity-0 group-hover:opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                        <Copy className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            <button
                onClick={handleCopyLink}
                className="w-full py-4 bg-white border border-[#E6E1DC] text-[#1A1F26] rounded-[20px] font-bold uppercase tracking-wider text-xs hover:border-[#1A1F26] hover:shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
                {linkCopied
                    ? <><Check className="w-4 h-4 text-emerald-600" /> {t.linkCopied}</>
                    : <><LinkIcon className="w-4 h-4 text-[#8A9099]" /> {t.copyLink}</>}
            </button>

            {isHost ? (
                <button
                    onClick={handleStart}
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
        </div>
      </main>
    </div>
  );
}