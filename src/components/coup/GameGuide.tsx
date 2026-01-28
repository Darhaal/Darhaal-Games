'use client';

import React from 'react';
import { X, Book, HelpCircle, Swords, Shield, Crown, Skull, Ban } from 'lucide-react';
import { Role, Lang } from '@/types/coup';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';

// --- ДАННЫЕ О РОЛЯХ ---
const ROLE_DETAILS: Record<Lang, Record<Role, { action: string; block: string }>> = {
  ru: {
    duke: { action: 'Налог (+3)', block: 'Помощь' },
    assassin: { action: 'Убийство (-3)', block: '-' },
    captain: { action: 'Кража (+2)', block: 'Кража' },
    ambassador: { action: 'Обмен', block: 'Кража' },
    contessa: { action: '-', block: 'Убийство' }
  },
  en: {
    duke: { action: 'Tax (+3)', block: 'Foreign Aid' },
    assassin: { action: 'Assassinate (-3)', block: '-' },
    captain: { action: 'Steal (+2)', block: 'Stealing' },
    ambassador: { action: 'Exchange', block: 'Stealing' },
    contessa: { action: '-', block: 'Assassination' }
  }
};

// --- КОМПОНЕНТ КАРТЫ (Экспортируем для использования в игре) ---
export const GameCard = ({ role, revealed, isMe, onClick, selected, lang, small = false, disabled = false, isLosing = false }: { role: Role, revealed: boolean, isMe: boolean, onClick?: () => void, selected?: boolean, lang: Lang, small?: boolean, disabled?: boolean, isLosing?: boolean }) => {
  if (!role || !ROLE_CONFIG[role]) return null;
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY[lang].roles[role];
  const details = ROLE_DETAILS[lang][role];

  // Размеры
  const dims = small ? 'w-24 h-36' : 'w-24 h-36 sm:w-28 sm:h-44';

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        relative ${dims} perspective-1000 group transition-all duration-500
        ${selected ? '-translate-y-6 z-30 scale-105' : 'hover:-translate-y-2 z-10'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        ${isLosing ? 'animate-pulse ring-4 ring-red-500 rounded-2xl' : ''}
        ${revealed && !small ? 'animate-throw-card' : ''}
      `}
    >
      <div className={`
        relative w-full h-full duration-500 preserve-3d transition-transform shadow-xl rounded-2xl
        ${(isMe || revealed) ? 'rotate-y-0' : ''}
      `}>

        {/* ЛИЦЕВАЯ СТОРОНА */}
        <div className={`
          absolute inset-0 backface-hidden rounded-2xl border-[3px] overflow-hidden bg-white flex flex-col p-2
          ${revealed ? 'grayscale brightness-90' : ''}
        `}
        style={{ borderColor: config.color }}
        >
           {/* Фон */}
           <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-black via-transparent to-transparent" />

           {/* Хедер */}
           <div className="w-full flex justify-between items-start z-10 mb-1">
              <span className="font-black text-[9px] sm:text-[10px] uppercase tracking-wider truncate" style={{ color: config.color }}>{info.name}</span>
              <config.icon className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" style={{ color: config.color }} />
           </div>

           {/* Арт */}
           <div className="flex-1 flex flex-col items-center justify-center z-10 gap-1">
              <div className="p-2 sm:p-3 rounded-full bg-white border-2 shadow-sm relative" style={{ borderColor: config.color }}>
                 <div className="absolute inset-0 rounded-full opacity-10" style={{ backgroundColor: config.color }} />
                 <config.icon className={`${small ? 'w-6 h-6' : 'w-8 h-8 sm:w-10 sm:h-10'}`} style={{ color: config.color }} />
              </div>
           </div>

           {/* Инфо (Действие/Блок) */}
           <div className="z-10 w-full space-y-1 mt-auto">
             <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
               <div className="w-3.5 h-3.5 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                 <Swords className="w-2 h-2 text-emerald-700" />
               </div>
               <span className="text-[8px] sm:text-[9px] font-bold text-gray-600 leading-none truncate w-full">{details.action}</span>
             </div>
             {details.block !== '-' && (
               <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
                 <div className="w-3.5 h-3.5 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                   <Shield className="w-2 h-2 text-red-700" />
                 </div>
                 <span className="text-[8px] sm:text-[9px] font-bold text-gray-600 leading-none truncate w-full">{details.block}</span>
               </div>
             )}
           </div>

           {/* Оверлей смерти */}
           {revealed && (
             <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-50 backdrop-blur-[1px]">
               <Skull className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-lg mb-1" />
               <span className="text-white font-black uppercase text-[8px] sm:text-[10px] tracking-widest border-2 border-white px-2 py-0.5 rounded">Dead</span>
             </div>
           )}
        </div>

        {/* РУБАШКА */}
        {!revealed && !isMe && (
          <div className="absolute inset-0 backface-hidden rounded-2xl bg-[#1A1F26] border-4 border-[#333] flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
             <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
             <div className="absolute inset-4 border border-[#E6E1DC]/20 rounded-xl" />
             <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-[#E6E1DC]/20 flex items-center justify-center bg-[#E6E1DC]/5 backdrop-blur-sm">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-[#E6E1DC] drop-shadow-md" />
             </div>
             <div className="mt-2 sm:mt-3 text-[8px] sm:text-[9px] font-black text-[#E6E1DC] tracking-[0.3em] uppercase">COUP</div>
          </div>
        )}
      </div>

      {/* Подсветка выбора */}
      {selected && (
        <div className="absolute -inset-3 rounded-[20px] bg-[#9e1316]/20 blur-xl -z-10 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};

// --- МОДАЛКИ ---

export const GuideModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  const roles: Role[] = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 border border-white/20">
        <div className="p-6 border-b border-[#E6E1DC] flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-[#1A1F26]">
            <Book className="w-8 h-8 text-[#9e1316]" /> {lang === 'ru' ? 'Справочник' : 'Guide'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-[#8A9099]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#F8FAFC]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map(role => {
              const info = ROLE_DETAILS[lang][role];
              const config = ROLE_CONFIG[role];
              return (
                <div key={role} className="flex flex-col items-center bg-white rounded-3xl p-4 border border-[#E6E1DC] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: config.color }} />
                  <div className="scale-90 origin-top -mb-2">
                    <GameCard role={role} revealed={false} isMe={true} lang={lang} small={true} />
                  </div>
                  <div className="mt-4 w-full space-y-2">
                    <div className="text-xs font-medium text-center text-gray-500 min-h-[3em]">{DICTIONARY[lang].roles[role].desc}</div>

                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                          <Swords className="w-3 h-3 text-emerald-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Action</div>
                          <div className="text-[10px] font-bold text-[#1A1F26] leading-tight truncate">{info.action}</div>
                        </div>
                    </div>
                    {info.block !== '-' && (
                      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                          <div className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                            <Ban className="w-3 h-3 text-red-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Block</div>
                            <div className="text-[10px] font-bold text-[#1A1F26] leading-tight truncate">{info.block}</div>
                          </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RulesModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden animate-in zoom-in-95 border border-white/20">
        <div className="p-6 border-b border-[#E6E1DC] flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-[#1A1F26]">
            <HelpCircle className="w-8 h-8 text-[#9e1316]" /> {lang === 'ru' ? 'Правила' : 'Rules'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-[#8A9099]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-sm text-[#334155] leading-relaxed bg-[#F8FAFC]">
          <section>
            <h3 className="font-black text-[#1A1F26] uppercase mb-2 flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-600" /> {lang === 'ru' ? 'Цель' : 'Goal'}</h3>
            <p className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-yellow-900 font-medium">
              {lang === 'ru' ? 'Остаться последним игроком с хотя бы 1 картой влияния.' : 'Be the last player with at least 1 influence card.'}
            </p>
          </section>

          <section className="mt-6">
            <h3 className="font-black text-[#1A1F26] uppercase mb-3">💰 {lang === 'ru' ? 'Действия' : 'Actions'}</h3>
            <div className="space-y-2">
              <div className="bg-white p-3 rounded-xl border border-[#E6E1DC] flex gap-3 items-center">
                 <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">+1</div>
                 <div>
                    <div className="font-bold text-[#1A1F26]">Income</div>
                    <div className="text-xs text-gray-500">Нельзя заблокировать</div>
                 </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E6E1DC] flex gap-3 items-center">
                 <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">+2</div>
                 <div>
                    <div className="font-bold text-[#1A1F26]">Foreign Aid</div>
                    <div className="text-xs text-gray-500">Блок: <span className="text-purple-600 font-bold">Duke</span></div>
                 </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E6E1DC] flex gap-3 items-center">
                 <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-black text-xs">-7</div>
                 <div>
                    <div className="font-bold text-[#9e1316]">Coup</div>
                    <div className="text-xs text-gray-500">Нельзя блок. Убивает карту.</div>
                 </div>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <h3 className="font-black text-[#1A1F26] uppercase mb-3 text-red-600">❗ {lang === 'ru' ? 'Блеф' : 'Bluff'}</h3>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-900 text-xs font-medium space-y-2">
              <p>{lang === 'ru' ? 'Любое действие карты можно оспорить.' : 'Any card action can be challenged.'}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>{lang === 'ru' ? 'Игрок соврал -> Теряет карту.' : 'Liar -> Loses card.'}</li>
                <li>{lang === 'ru' ? 'Игрок доказал -> Оспоривший теряет карту.' : 'Truth -> Challenger loses card.'}</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};