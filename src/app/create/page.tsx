'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useLang } from '@/hooks/useLang';
import { errorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { COPYRIGHT, defaultAvatar, generateRoomCode } from '@/constants/app';
import SettingsButton from '@/components/SettingsButton';
import {
  ArrowLeft, Users, Lock, Unlock,
  ArrowRight, Eye, EyeOff, Loader2, Type, UserPlus, Zap
} from 'lucide-react';
import { GAMES, playerRange, type GameDefinition } from '@/games/registry';
import { GAME_ICONS } from '@/games/icons';
import {
  GAME_OPTIONS, defaultOptionValues, num, playersFromOptions,
  type GameOption, type OptionValues
} from '@/games/options';
import { createInitialState } from '@/games/initialState';
import { track } from '@/lib/analytics';
import { GA_EVENTS } from '@/constants/analytics';

const TRANSLATIONS = {
  ru: {
    select: 'Выбор игры',
    selectSub: 'Доступные режимы',
    settings: 'Настройки',
    settingsSub: 'Параметры лобби',
    create: 'Создать',
    private: 'Закрытая игра',
    password: 'Пароль',
    players: 'Игроки',
    error: 'Ошибка',
    lobbyName: 'Название',
    enterName: 'Имя комнаты...',
    enterPass: '••••••',
    lobbySuffix: 'Лобби',
    footer: COPYRIGHT
  },
  en: {
    select: 'Select Game',
    selectSub: 'Available modes',
    settings: 'Settings',
    settingsSub: 'Lobby configuration',
    create: 'Create',
    private: 'Private Game',
    password: 'Password',
    players: 'Players',
    error: 'Error',
    lobbyName: 'Name',
    enterName: 'Room name...',
    enterPass: '••••••',
    lobbySuffix: 'Lobby',
    footer: COPYRIGHT
  }
};

const LABEL_CLASS =
  'text-2xs font-black text-[#8A9099] uppercase tracking-widest ml-1 flex items-center gap-2';
const BADGE_CLASS = 'text-xs font-bold text-white bg-[#1A1F26] px-2 py-0.5 rounded tabular-nums';
const RANGE_CLASS =
  'w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#1A1F26]';

/**
 * Renders one declared option from `src/games/options.ts`.
 *
 * Hoisted to module scope rather than nested in the page component: a
 * component declared during render is a new type on every pass, so React would
 * unmount and remount each control — which loses the drag on a slider.
 */
function OptionControl({
  option, values, lang, onChange
}: {
  option: GameOption;
  values: OptionValues;
  lang: 'ru' | 'en';
  onChange: (key: string, value: number | string) => void;
}) {
  if (option.kind === 'slider') {
    const value = num(values, option.key, option.default);
    const display = option.format
      ? option.format(value, lang)
      : `${value}${option.unit ? ' ' + option.unit[lang] : ''}`;
    const note = option.note?.(values, lang);
    const Icon = option.icon;

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className={LABEL_CLASS}>
            <Icon className="w-3.5 h-3.5 text-gray-400" /> {option.label[lang]}
          </label>
          <span className={BADGE_CLASS}>{display}</span>
        </div>
        <input
          type="range"
          min={option.min}
          max={option.max}
          step={option.step}
          value={value}
          onChange={(e) => onChange(option.key, Number(e.target.value))}
          className={RANGE_CLASS}
        />
        {note && (
          <div className="text-2xs font-bold text-gray-500 px-2 bg-[#F8FAFC] py-1.5 rounded text-center">
            {note}
          </div>
        )}
      </div>
    );
  }

  const selected = option.choices.find((c) => c.value === values[option.key]);
  const Icon = option.icon;

  return (
    <div className="space-y-3">
      <label className={LABEL_CLASS}>
        <Icon className="w-3.5 h-3.5 text-gray-400" /> {option.label[lang]}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {option.choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(option.key, choice.value)}
            className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${
              values[option.key] === choice.value
                ? 'bg-[#1A1F26] text-white border-[#1A1F26] shadow-md'
                : 'bg-white text-[#1A1F26] border-[#E6E1DC] hover:border-[#1A1F26]'
            }`}
          >
            {choice.emoji && <span className="text-lg">{choice.emoji}</span>}
            <span className="text-xs font-bold">{choice.label[lang]}</span>
          </button>
        ))}
      </div>

      {selected?.preview && (
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E6E1DC]">
          <div className="text-2xs font-bold text-[#8A9099] uppercase tracking-widest mb-3">
            {option.previewLabel[lang]}
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.preview[lang].map((item) => (
              <span
                key={item}
                className="text-2xs font-bold bg-white px-2 py-1 rounded-md border border-[#E6E1DC] text-[#1A1F26]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { lang } = useLang();
  const [step, setStep] = useState<'selection' | 'settings'>('selection');
  const [selectedGame, setSelectedGame] = useState<GameDefinition | null>(null);

  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [lobbyName, setLobbyName] = useState('');
  /**
   * The last name this page generated on its own. Switching games should
   * refresh the suggested name, but must never overwrite one the user typed —
   * comparing against this tells the two apart.
   */
  const autoNameRef = useRef('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  /** Whatever the chosen game declares in GAME_OPTIONS, keyed by option key. */
  const [optionValues, setOptionValues] = useState<OptionValues>({});

  useEffect(() => {
    const checkUser = async () => {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
            setUser(data.user);
        } else {
            const currentPath = window.location.pathname + window.location.search;
            router.push(`/?returnUrl=${encodeURIComponent(currentPath)}`);
        }
        setAuthLoading(false);
    };
    checkUser();
  }, [router]);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (!selectedGame) return;

    const defaults = defaultOptionValues(selectedGame.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the editable player-count control from the chosen game; the user can then change it, so it cannot be derived during render
    setMaxPlayers(playersFromOptions(selectedGame.id, defaults) ?? selectedGame.players.max);
    setOptionValues(defaults);

    // Reseed while the field still holds our own suggestion (or is empty):
    // picking Spyfall, going back and picking Flager used to keep the
    // Spyfall name, because the old guard only checked for emptiness.
    if (user && (!lobbyName || lobbyName === autoNameRef.current)) {
        const userName = user.user_metadata?.username || user.email?.split('@')[0] || 'Player';
        const generated = `${selectedGame.name[lang]} ${t.lobbySuffix} - ${userName}`;
        autoNameRef.current = generated;
        setLobbyName(generated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed defaults only when the game/user/language changes, not on every lobbyName keystroke
  }, [selectedGame, user, lang]);

  const setOption = (key: string, value: number | string) =>
    setOptionValues((prev) => {
      const next = { ...prev, [key]: value };
      // A mode-driven game carries its headcount in the option itself.
      if (selectedGame) {
        const fixed = playersFromOptions(selectedGame.id, next);
        if (fixed) setMaxPlayers(fixed);
      }
      return next;
    });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame || !user) return;
    setLoading(true);

    try {
      const userName =
        user.user_metadata?.username ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'Player';
      // Our own /avatar route, never api.dicebear.com: the seed is the Supabase
      // user id, and this screen was still handing those to a third party long
      // after the rest of the app stopped.
      const userAvatar = user.user_metadata?.avatar_url || defaultAvatar(user.id);

      const gameState = createInitialState(
        selectedGame.id,
        { id: user.id, name: userName, avatarUrl: userAvatar },
        maxPlayers,
        optionValues
      );

      // Insert with retry in case of a room-code collision (unique index on code)
      let data = null;
      let error = null;
      let insertCode = generateRoomCode();
      for (let attempt = 0; attempt < 3; attempt++) {
        ({ data, error } = await supabase.from('lobbies').insert({
          code: insertCode, name: lobbyName, host_id: user.id, is_private: isPrivate, password: isPrivate ? password : null, status: 'waiting', game_state: gameState,
          // Select only `id` — a bare .select() means `*`, which needs SELECT on
          // every column including `password`, and clients no longer hold that.
        }).select('id').single());

        if (!error) break;
        if (error.code !== '23505') break; // not a collision — do not retry
        insertCode = generateRoomCode();
      }

      if (error || !data) throw error || new Error('Insert failed');

      // Categories and counts only — never the room id, which is its invitation.
      track(GA_EVENTS.lobbyCreated, {
        game: selectedGame.id,
        max_players: maxPlayers,
        is_private: isPrivate
      });

      router.push(`/game/${selectedGame.id}?id=${data.id}`);
    } catch (error: unknown) {
      track(GA_EVENTS.appError, { where: 'create_lobby' });
      showToast(t.error + ': ' + errorMessage(error), 'error');
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><Loader2 className="animate-spin text-[#9e1316] w-8 h-8" /></div>;
  if (!user) return null;

  const SelectedIcon = selectedGame ? GAME_ICONS[selectedGame.id] : null;

  const renderSelection = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-4xl animate-in zoom-in-95 duration-500 pb-8">
      {GAMES.map(game => {
        const Icon = GAME_ICONS[game.id];
        return (
          <button
            key={game.id}
            onClick={() => { setSelectedGame(game); setStep('settings'); }}
            className="group relative overflow-hidden rounded-[32px] p-1 text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-[#1A1F26]/5 border border-[#E6E1DC] bg-white hover:border-[#9e1316]/20"
          >
            <div className="relative z-20 p-5 sm:p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                   <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 bg-[#F8FAFC] border border-[#E6E1DC] text-[#1A1F26] group-hover:bg-[#1A1F26] group-hover:text-white group-hover:border-[#1A1F26]">
                     <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
                   </div>
                </div>

                <div className="mt-auto">
                    <h3 className="text-xl font-black text-[#1A1F26] mb-1 group-hover:text-[#9e1316] transition-colors">{game.name[lang]}</h3>
                    <p className="text-xs font-medium text-gray-500 leading-relaxed min-h-[40px]">{game.tagline[lang]}</p>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A1F26] mt-4 pt-4 border-t border-[#F1F5F9]">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {playerRange(game)}
                    </div>
                </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderSettings = () => (
    <form onSubmit={handleCreate} className="w-full max-w-lg bg-white border border-[#E6E1DC] rounded-[40px] p-8 shadow-2xl shadow-[#1A1F26]/5 animate-in slide-in-from-right-8 duration-500 relative overflow-hidden mb-8">
       <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-16 h-16 bg-[#1A1F26] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#1A1F26]/20">
             {SelectedIcon && <SelectedIcon className="w-8 h-8" />}
          </div>
          <div>
              <h2 className="text-2xl font-black text-[#1A1F26] leading-tight">{selectedGame?.name[lang]}</h2>
              <p className="text-xs font-bold text-[#8A9099] uppercase tracking-wider">{t.settingsSub}</p>
          </div>
       </div>

       <div className="space-y-6 relative z-10">
          <div className="space-y-2">
               <label className={LABEL_CLASS}><Type className="w-3 h-3"/> {t.lobbyName}</label>
               <input
                   type="text"
                   value={lobbyName}
                   onChange={e => setLobbyName(e.target.value)}
                   placeholder={t.enterName}
                   className="w-full bg-[#F8FAFC] border border-gray-200 focus:bg-white focus:border-[#1A1F26] rounded-xl py-3 px-4 font-bold text-[#1A1F26] outline-none transition-all placeholder:text-gray-400 text-sm"
                   required
               />
          </div>

          {/* Hidden for a game whose mode fixes the headcount — Wall Rush is a
              duel or a four, never a three, so a slider would offer a table
              that cannot be dealt. */}
          {selectedGame && !selectedGame.playersFromOption
            && selectedGame.players.min !== selectedGame.players.max && (
            <div className="space-y-3">
               <div className="flex justify-between items-center">
                    <label className={LABEL_CLASS}><UserPlus className="w-3.5 h-3.5 text-gray-400"/> {t.players}</label>
                    <span className={BADGE_CLASS}>{maxPlayers}</span>
               </div>
               <input
                   type="range"
                   min={selectedGame.players.min}
                   max={selectedGame.players.max}
                   step={1}
                   value={maxPlayers}
                   onChange={e => setMaxPlayers(Number(e.target.value))}
                   className={RANGE_CLASS}
               />
               <div className="flex justify-between text-2xs font-medium text-gray-400 px-1">
                   <span>{selectedGame.players.min}</span>
                   <span>{selectedGame.players.max}</span>
               </div>
            </div>
          )}

          {/* Whatever this game declares in GAME_OPTIONS — no per-game JSX here. */}
          {selectedGame && GAME_OPTIONS[selectedGame.id].length > 0 && (
            <div className="space-y-6 pt-5 border-t border-[#F1F5F9] animate-in fade-in">
              {GAME_OPTIONS[selectedGame.id].map(option => (
                <OptionControl
                  key={option.key}
                  option={option}
                  values={optionValues}
                  lang={lang}
                  onChange={setOption}
                />
              ))}
            </div>
          )}

          <div className="h-px bg-[#F1F5F9] w-full" />

          <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-xl cursor-pointer border border-transparent hover:border-gray-200 transition-all group" onClick={() => setIsPrivate(!isPrivate)}>
             <div className="flex items-center gap-3">
               <div className={`p-1.5 rounded-lg transition-colors ${isPrivate ? 'bg-[#1A1F26] text-white' : 'bg-gray-200 text-gray-500'}`}>
                   {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
               </div>
               <span className="font-bold text-[#1A1F26] text-xs uppercase tracking-wide">{t.private}</span>
             </div>
             <div className={`w-10 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-[#1A1F26]' : 'bg-gray-200'}`}>
               <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${isPrivate ? 'translate-x-4' : ''}`} />
             </div>
          </div>

          {isPrivate && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
               <label className="text-xs font-bold text-[#1A1F26] ml-1">{t.password}</label>
               <div className="relative">
                 <input
                   type={showPassword ? "text" : "password"}
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   placeholder={t.enterPass}
                   className="w-full bg-[#F8FAFC] border border-gray-200 focus:bg-white focus:border-[#1A1F26] rounded-xl py-3 px-4 font-bold text-[#1A1F26] outline-none transition-all placeholder:text-gray-400 text-sm text-center"
                   required={isPrivate}
                 />
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-[#1A1F26]">
                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                 </button>
               </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1F26] text-white py-4 rounded-xl font-black uppercase tracking-wide hover:bg-[#9e1316] hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <> {t.create} <ArrowRight className="w-4 h-4" /> </>}
          </button>
       </div>
    </form>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#9e1316]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER: STICKY & UNIFIED */}
      <header className="sticky top-0 z-30 w-full bg-[#F8FAFC]/90 backdrop-blur-xl border-b border-[#E6E1DC] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button onClick={() => { if (step === 'selection') router.push('/'); else setStep('selection'); }} className="group p-2.5 md:p-3 bg-white border border-[#E6E1DC] rounded-xl hover:border-[#9e1316]/30 hover:shadow-sm transition-all">
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-[#8A9099] group-hover:text-[#9e1316]" />
            </button>
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-[#1A1F26] tracking-tight leading-none">{step === 'selection' ? t.select : t.settings}</h1>
                <p className="text-xs text-[#8A9099] font-medium hidden sm:block">
                    {step === 'selection' ? t.selectSub : (selectedGame ? selectedGame.name[lang] : t.settingsSub)}
                </p>
            </div>
          </div>
          <div className="flex justify-end">
            <SettingsButton />
          </div>
        </div>
      </header>

      <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 pb-20 px-4 sm:px-6 py-8">
        {step === 'selection' && renderSelection()}
        {step === 'settings' && renderSettings()}
      </div>

      <footer className="w-full p-8 text-center z-10 opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[#1A1F26] text-2xs font-black uppercase tracking-[0.3em] cursor-default flex items-center justify-center gap-2">
            <Zap className="w-3 h-3 text-[#9e1316]" /> {t.footer}
        </p>
      </footer>
    </div>
  );
}
