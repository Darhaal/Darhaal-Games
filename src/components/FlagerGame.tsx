'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LogOut, Check, X, Flag, Trophy, Search, HelpCircle, Loader2 } from 'lucide-react';
import { FlagerState } from '@/types/flager';
import { COUNTRIES, COUNTRY_CODES } from '@/data/flager/countries';

interface FlagerGameProps {
  gameState: FlagerState;
  userId: string;
  makeGuess: (code: string) => void;
  leaveGame: () => void;
}

// ----------------------------------------------------------------------
// MAGIC REVEAL CANVAS COMPONENT
// ----------------------------------------------------------------------
// 1. Renders the TARGET flag.
// 2. Renders a black mask over it.
// 3. Renders GUESS flags invisibly.
// 4. Compares pixels: if GUESS pixel matches TARGET pixel (tolerance), mask becomes transparent.
// ----------------------------------------------------------------------
const FlagRevealCanvas = ({ targetCode, guesses }: { targetCode: string, guesses: string[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use a fixed size for pixel manipulation to keep it fast
  const WIDTH = 320;
  const HEIGHT = 213; // Approx 3:2

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Load Target
    const targetImg = new Image();
    targetImg.crossOrigin = "Anonymous";
    targetImg.src = `https://flagcdn.com/w320/${targetCode.toLowerCase()}.png`;

    targetImg.onload = () => {
        setIsLoading(false);
        // Start with black mask
        ctx.fillStyle = '#1A1F26';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        if (guesses.length === 0) return;

        // Create buffers
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = WIDTH;
        targetCanvas.height = HEIGHT;
        const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
        if(!targetCtx) return;

        targetCtx.drawImage(targetImg, 0, 0, WIDTH, HEIGHT);
        const targetData = targetCtx.getImageData(0, 0, WIDTH, HEIGHT);

        const mask = new Uint8Array(WIDTH * HEIGHT).fill(0); // 0 = hidden, 1 = reveal

        // Load and process all guesses
        let processedCount = 0;

        guesses.forEach(guessCode => {
            const guessImg = new Image();
            guessImg.crossOrigin = "Anonymous";
            guessImg.src = `https://flagcdn.com/w320/${guessCode.toLowerCase()}.png`;

            guessImg.onload = () => {
                const guessCanvas = document.createElement('canvas');
                guessCanvas.width = WIDTH;
                guessCanvas.height = HEIGHT;
                const guessCtx = guessCanvas.getContext('2d', { willReadFrequently: true });
                if(!guessCtx) return;

                guessCtx.drawImage(guessImg, 0, 0, WIDTH, HEIGHT);
                const guessData = guessCtx.getImageData(0, 0, WIDTH, HEIGHT);

                // Pixel Match Logic
                for (let i = 0; i < targetData.data.length; i += 4) {
                    const idx = i / 4;
                    if (mask[idx] === 1) continue; // Already revealed

                    // Simple RGB euclidean distance or absolute diff
                    const rDist = Math.abs(targetData.data[i] - guessData.data[i]);
                    const gDist = Math.abs(targetData.data[i+1] - guessData.data[i+1]);
                    const bDist = Math.abs(targetData.data[i+2] - guessData.data[i+2]);

                    // Tolerance is key.
                    // 30 is strict enough to distinguish similar reds, but loose enough for compression artifacts.
                    if (rDist < 40 && gDist < 40 && bDist < 40) {
                        mask[idx] = 1;
                    }
                }

                processedCount++;
                if (processedCount === guesses.length) {
                    // Final Draw
                    const finalImageData = ctx.createImageData(WIDTH, HEIGHT);
                    for (let i = 0; i < mask.length; i++) {
                        const ptr = i * 4;
                        if (mask[i] === 1) {
                            // Show Target
                            finalImageData.data[ptr] = targetData.data[ptr];
                            finalImageData.data[ptr+1] = targetData.data[ptr+1];
                            finalImageData.data[ptr+2] = targetData.data[ptr+2];
                            finalImageData.data[ptr+3] = 255;
                        } else {
                            // Show Mask (Dark Grey)
                            finalImageData.data[ptr] = 30;
                            finalImageData.data[ptr+1] = 30;
                            finalImageData.data[ptr+2] = 35;
                            finalImageData.data[ptr+3] = 255;
                        }
                    }
                    ctx.putImageData(finalImageData, 0, 0);
                }
            };
        });
    };

  }, [targetCode, guesses]);

  return (
    <div className="relative w-full h-[250px] bg-gray-100 rounded-lg overflow-hidden shadow-md flex items-center justify-center">
       {isLoading && <Loader2 className="w-8 h-8 text-gray-400 animate-spin absolute" />}
       <canvas ref={canvasRef} width={320} height={213} className="w-full h-full object-contain z-10" />
       <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm z-20 pointer-events-none">
          Pixel Match
       </div>
    </div>
  );
};

export default function FlagerGame({ gameState, userId, makeGuess, leaveGame }: FlagerGameProps) {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
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
      const continent = COUNTRIES[code]?.continent;

      return (
          <div className={`flex items-center justify-between p-3 rounded-xl border mb-2 animate-in slide-in-from-bottom-2 ${isCorrect ? 'bg-emerald-100 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center gap-3">
                  <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={code} className="w-8 h-6 object-cover rounded shadow-sm border border-black/10" />
                  <div className="flex flex-col">
                      <span className="font-bold text-sm">{name}</span>
                      {!isCorrect && <span className="text-[10px] opacity-70">{continent}</span>}
                  </div>
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

  const isRoundDone = me?.hasFinishedRound;
  const isCorrect = isRoundDone && me.guesses[me.guesses.length-1] === currentFlag;

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

              {/* CANVAS FLAG REVEAL */}
              {currentFlag && !isRoundDone ? (
                   <FlagRevealCanvas targetCode={currentFlag} guesses={me?.guesses || []} />
              ) : (
                  <div className="bg-white p-4 rounded-[32px] border border-[#E6E1DC] shadow-lg flex items-center justify-center min-h-[250px]">
                      {currentFlag && <img src={`https://flagcdn.com/w640/${currentFlag.toLowerCase()}.png`} className="w-full h-auto max-h-[300px] object-contain shadow-md rounded-lg" />}
                  </div>
              )}

              {isRoundDone && (
                  <div className={`border p-4 rounded-xl text-center ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className={`font-bold text-sm mb-1 ${isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                          {isCorrect ? 'Правильно!' : 'Вы сдались'}
                      </div>
                      <div className="text-lg font-black text-[#1A1F26] mb-2">{COUNTRIES[currentFlag]?.name[lang]}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-bold">Ожидание других игроков...</div>
                  </div>
              )}

              {!isRoundDone && (
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
                  <h3 className="text-xs font-black text-[#8A9099] uppercase tracking-widest mb-4">Ваши попытки ({me?.guesses.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {me?.guesses.slice().reverse().map((code, i) => (
                          <GuessRow key={i} code={code} target={currentFlag} />
                      ))}
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