'use client';

import React, { useState, useMemo } from 'react';
import { LogOut, Check, X, Flag, Trophy, Search } from 'lucide-react';
import { FlagerState } from '@/types/flager';
import { COUNTRIES, COUNTRY_CODES } from '@/data/flager/countries';

const MAX_GUESSES = 6;

interface FlagerGameProps {
  gameState: FlagerState;
  userId: string;
  makeGuess: (code: string) => void;
  leaveGame: () => void;
}

export default function FlagerGame({ gameState, userId, makeGuess, leaveGame }: FlagerGameProps) {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Определяем язык (пока хардкод, но можно брать из localStorage)
  const lang: 'ru' | 'en' = 'ru';

  const me = gameState.players.find(p => p.id === userId);
  const currentFlag = gameState.targetChain[gameState.currentRoundIndex];
  const isFinished = gameState.status === 'finished';

  const filteredCountries = useMemo(() => {
    if (!input) return [];
    return COUNTRY_CODES.filter(code =>
      COUNTRIES[code].name[lang].toLowerCase().includes(input.toLowerCase()) &&
      !me?.guesses.includes(code)
    ).slice(0, 5);
  }, [input, me?.guesses, lang]);

  const handleGuess = (code: string) => {
      makeGuess(code);
      setInput('');
      setShowDropdown(false);
  };

  const GuessRow = ({ code, target }: { code: string, target: string }) => {
      const isCorrect = code === target;
      const name = COUNTRIES[code]?.name[lang] || code;

      return (
          <div className={`flex items-center justify-between p-3 rounded-xl border mb-2 animate-in slide-in-from-bottom-2 ${isCorrect ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center gap-3">
                  <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={code} className="w-8 h-6 object-cover rounded shadow-sm border border-black/10" />
                  <span className="font-bold text-sm">{name}</span>
              </div>
              {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </div>
      );
  };

  if (isFinished) {
      const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
      const winner = sortedPlayers[0];
      const isWinner = winner.id === userId;

      return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in">
            <div className="bg-white p-8 rounded-[32px] w-full max-w-md text-center border-4 border-[#9e1316] shadow-2xl">
                <Trophy className={`w-20 h-20 mx-auto mb-4 ${isWinner ? 'text-yellow-500 animate-bounce' : 'text-gray-300'}`} />
                <h2 className="text-2xl font-black uppercase text-[#1A1F26] mb-2">{isWinner ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА'}</h2>
                <div className="space-y-3 mb-8">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl ${p.id === userId ? 'bg-[#9e1316]/10 border border-[#9e1316]/20' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                                <span className="font-black text-gray-400 w-4">#{i+1}</span>
                                <span className="font-bold text-[#1A1F26]">{p.name}</span>
                            </div>
                            <span className="font-black text-[#9e1316]">{p.score} pts</span>
                        </div>
                    ))}
                </div>
                <button onClick={leaveGame} className="w-full py-4 bg-[#1A1F26] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#9e1316] transition-colors">
                    В меню
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A1F26] flex flex-col font-sans overflow-hidden relative">
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-50 mix-blend-overlay pointer-events-none" />

       <header className="w-full max-w-4xl mx-auto p-4 flex justify-between items-center z-10 relative">
          <button onClick={leaveGame} className="p-2 bg-white border border-[#E6E1DC] rounded-xl text-gray-400 hover:text-[#9e1316]"><LogOut className="w-5 h-5" /></button>
          <div className="flex flex-col items-center">
              <h1 className="font-black text-xl uppercase tracking-tight flex items-center gap-2"><Flag className="w-5 h-5 text-[#9e1316]"/> FLAGGER</h1>
              <div className="text-[10px] font-bold text-[#8A9099] uppercase tracking-wider">Раунд {gameState.currentRoundIndex + 1}/{gameState.targetChain.length}</div>
          </div>
          <div className="w-10" />
       </header>

       <main className="flex-1 w-full max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
          <div className="flex flex-col gap-6">
              <div className="bg-white p-4 rounded-[32px] border border-[#E6E1DC] shadow-lg flex items-center justify-center min-h-[250px] relative overflow-hidden">
                   {currentFlag ? (
                       <img
                         src={`https://flagcdn.com/w640/${currentFlag.toLowerCase()}.png`}
                         alt="Guess the flag"
                         className="w-full h-auto max-h-[300px] object-contain shadow-md rounded-lg"
                       />
                   ) : (
                       <div className="text-gray-300 font-bold">Loading...</div>
                   )}

                   {me?.hasFinishedRound && (
                       <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in">
                           <div className="text-4xl font-black mb-2">{currentFlag === me.guesses[me.guesses.length-1] ? 'ВЕРНО!' : 'РАУНД ЗАВЕРШЕН'}</div>
                           <div className="text-lg font-bold opacity-80">{COUNTRIES[currentFlag]?.name[lang]}</div>
                           <div className="mt-4 text-xs font-bold uppercase tracking-widest bg-white/20 px-4 py-1 rounded-full">Ожидание других...</div>
                       </div>
                   )}
              </div>

              {!me?.hasFinishedRound && (
                  <div className="relative">
                      <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setShowDropdown(true); }}
                            placeholder="Введите название страны..."
                            className="w-full bg-white border-2 border-[#E6E1DC] rounded-xl py-4 pl-12 pr-4 font-bold text-[#1A1F26] focus:border-[#9e1316] focus:outline-none transition-colors shadow-sm"
                        />
                        <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                      </div>

                      {showDropdown && input.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E6E1DC] rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                              {filteredCountries.map(code => (
                                  <button
                                      key={code}
                                      onClick={() => handleGuess(code)}
                                      className="w-full text-left px-4 py-3 hover:bg-[#F5F5F0] font-bold text-sm flex items-center gap-3 border-b border-gray-50 last:border-0"
                                  >
                                      <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} className="w-6 h-4 object-cover rounded shadow-sm" />
                                      {COUNTRIES[code].name[lang]}
                                  </button>
                              ))}
                              {filteredCountries.length === 0 && (
                                  <div className="p-4 text-center text-gray-400 text-xs font-bold uppercase">Ничего не найдено</div>
                              )}
                          </div>
                      )}
                  </div>
              )}
          </div>

          <div className="flex flex-col gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-[#E6E1DC] shadow-sm flex-1">
                  <h3 className="text-xs font-black text-[#8A9099] uppercase tracking-widest mb-4">Ваши попытки ({me?.guesses.length}/{MAX_GUESSES})</h3>
                  <div className="space-y-2">
                      {me?.guesses.map((code, i) => (
                          <GuessRow key={i} code={code} target={currentFlag} />
                      ))}
                      {me?.guesses.length === 0 && (
                          <div className="text-center text-gray-300 text-sm font-bold py-10">Пока нет попыток</div>
                      )}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-[32px] border border-[#E6E1DC] shadow-sm">
                  <h3 className="text-xs font-black text-[#8A9099] uppercase tracking-widest mb-4">Игроки</h3>
                  <div className="space-y-3">
                      {gameState.players.map(p => (
                          <div key={p.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                                      {p.avatarUrl && <img src={p.avatarUrl} className="w-full h-full object-cover" />}
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="font-bold text-xs">{p.name}</span>
                                      <span className="text-[9px] font-bold text-gray-400 uppercase">{p.hasFinishedRound ? 'Закончил' : 'Думает...'}</span>
                                  </div>
                              </div>
                              <div className="font-black text-[#1A1F26]">{p.score} pts</div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
       </main>
    </div>
  );
}