'use client';

import React, { useState } from 'react';
import {
  Crown, X, Shield, History,
  Book, HelpCircle,
  Swords, Skull
} from 'lucide-react';
import { ROLE_CONFIG, DICTIONARY } from '@/constants/coup';
import { Role, Lang } from '@/types/coup';

// --- GAME CARD ---
interface GameCardProps {
  role: Role;
  revealed: boolean;
  isMe: boolean;
  onClick?: () => void;
  selected?: boolean;
  lang: Lang;
  small?: boolean;
  disabled?: boolean;
  isLosing?: boolean;
}

export const GameCard = ({ role, revealed, isMe, onClick, selected, lang, small = false, disabled = false, isLosing = false }: GameCardProps) => {
  if (!role || !ROLE_CONFIG[role] || !DICTIONARY[lang]?.roles[role]) return null;
  const config = ROLE_CONFIG[role];
  const info = DICTIONARY[lang].roles[role];

  const dims = small ? 'w-16 h-24 sm:w-20 sm:h-28' : 'w-24 h-36 sm:w-28 sm:h-44';

  return (
    <div className="flex flex-col items-center gap-1.5 group relative z-0">
        <div
        onClick={!disabled ? onClick : undefined}
        className={`
            relative ${dims} perspective-1000 transition-all duration-300 flex-shrink-0 z-10
            ${selected ? '-translate-y-4 z-30 scale-105' : 'hover:-translate-y-2'}
            ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            ${isLosing ? 'ring-4 ring-red-500 rounded-2xl animate-pulse' : ''}
        `}
        >
        <div className={`relative w-full h-full duration-500 preserve-3d transition-transform shadow-xl rounded-2xl ${(isMe || revealed) ? 'rotate-y-0' : ''}`}>
            {/* FACE */}
            <div className={`absolute inset-0 backface-hidden rounded-2xl border-[3px] overflow-hidden bg-white flex flex-col p-1.5 sm:p-2 ${revealed ? 'grayscale brightness-90' : ''}`} style={{ borderColor: config.color }}>
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-black" />
            <div className="w-full flex justify-between items-start z-10 mb-1">
                <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-wider truncate" style={{ color: config.color }}>{info.name}</span>
                <config.icon className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" style={{ color: config.color }} />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center z-10">
                <div className="p-2 sm:p-3 rounded-full bg-white border-2 shadow-sm relative" style={{ borderColor: config.color }}>
                    <div className="absolute inset-0 rounded-full opacity-10" style={{ backgroundColor: config.color }} />
                    <config.icon className={`${small ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-8 h-8 sm:w-10 sm:h-10'}`} style={{ color: config.color }} />
                </div>
            </div>
            {/* Stats - INTERNAL */}
            {!small && (
                <div className="z-10 w-full space-y-1 mt-auto">
                    <div className="flex items-center gap-1 bg-gray-50/90 backdrop-blur-sm rounded p-1 border border-gray-100 shadow-sm">
                        <Swords className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                        <span className="text-[7px] sm:text-[8px] font-black text-gray-700 uppercase leading-none truncate">{info.action}</span>
                    </div>
                    {info.block !== '-' && (
                        <div className="flex items-center gap-1 bg-gray-50/90 backdrop-blur-sm rounded p-1 border border-gray-100 shadow-sm">
                            <Shield className="w-2.5 h-2.5 text-red-600 shrink-0" />
                            <span className="text-[7px] sm:text-[8px] font-black text-gray-700 uppercase leading-none truncate">{info.block}</span>
                        </div>
                    )}
                </div>
            )}
            {revealed && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 backdrop-blur-[1px]">
                <Skull className="w-8 h-8 text-white drop-shadow-lg mb-1" />
                </div>
            )}
            </div>
            {/* BACK */}
            {!revealed && !isMe && (
            <div className="absolute inset-0 backface-hidden rounded-2xl bg-[#1A1F26] border-4 border-[#333] flex flex-col items-center justify-center shadow-inner">
                <div className="absolute inset-4 border border-[#E6E1DC]/20 rounded-xl" />
                <div className="w-12 h-12 rounded-full border-2 border-[#E6E1DC]/20 flex items-center justify-center bg-[#E6E1DC]/5">
                    <Crown className="w-6 h-6 text-[#E6E1DC]" />
                </div>
            </div>
            )}
        </div>
        </div>
    </div>
  );
};

// --- ACTION BUTTON ---
export const ActionBtn = ({ label, onClick, disabled, color = 'bg-white', icon: Icon }: any) => (
  <button onClick={onClick} disabled={disabled} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-b-[3px] transition-all active:translate-y-0.5 active:border-b-0 h-full relative overflow-hidden w-full ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400' : `${color} hover:brightness-95 text-[#1A1F26] shadow-sm`}`}>
    {Icon && <Icon className="w-4 h-4 mb-0.5" />}
    <span className="text-[9px] font-black uppercase leading-none text-center">{label}</span>
  </button>
);

// --- MODALS ---
export const RulesModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  const content = DICTIONARY[lang].rules;
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-black uppercase flex items-center gap-2"><HelpCircle className="w-6 h-6 text-[#9e1316]" /> {content.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-sm text-gray-600">
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-1">{content.objective.title}</h3>
             <p className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-yellow-800">{content.objective.text}</p>
           </section>
           <section>
              <h3 className="font-bold text-[#1A1F26] mb-1">{content.general?.title}</h3>
              <p className="mb-2">{content.general?.text}</p>
           </section>
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-2">{DICTIONARY[lang].ui.code} Actions</h3>
             <ul className="space-y-2">
               {content.actions.map((act, i) => (
                 <li key={i} className="flex gap-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[#1A1F26] shrink-0" />
                    <span><strong>{act.name}:</strong> {act.effect}</span>
                 </li>
               ))}
             </ul>
           </section>
           <section>
             <h3 className="font-bold text-[#1A1F26] mb-1">{content.challenge.title}</h3>
             <p className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-800 text-xs">{content.challenge.text}</p>
           </section>
        </div>
      </div>
    </div>
  );
};

export const GuideModal = ({ onClose, lang }: { onClose: () => void, lang: Lang }) => {
  const roles: Role[] = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-black uppercase flex items-center gap-2"><Book className="w-6 h-6 text-[#9e1316]" /> {lang === 'ru' ? 'Справочник' : 'Guide'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map(role => {
              const info = DICTIONARY[lang].roles[role];
              const config = ROLE_CONFIG[role];
              return (
                <div key={role} className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
                   <div className="shrink-0"><GameCard role={role} revealed={false} isMe={true} lang={lang} small={true} /></div>
                   <div className="flex-1 min-w-0">
                      <div className="font-black text-sm uppercase truncate" style={{ color: config.color }}>{info.name}</div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-1 mb-2 line-clamp-3">{info.desc}</p>
                      <div className="flex flex-wrap gap-1">
                         <span className="text-[9px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200 truncate max-w-full">{info.action}</span>
                         {info.block !== '-' && <span className="text-[9px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 truncate max-w-full">Block: {info.block}</span>}
                      </div>
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

export const LogPanel = ({ logs, lang }: { logs: any[], lang: Lang }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="md:hidden fixed top-20 left-4 z-40 bg-white p-2 rounded-full shadow-lg border border-[#E6E1DC]">
        <History className="w-5 h-5 text-[#8A9099]" />
      </button>

      <div className={`fixed md:absolute top-24 left-4 z-30 w-72 max-h-64 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E6E1DC] shadow-xl flex flex-col overflow-hidden transition-all duration-300 transform ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 md:translate-x-0 md:opacity-100'}`}>
         <div className="px-4 py-3 border-b border-[#E6E1DC] bg-gray-50/50 flex justify-between items-center">
           <div className="text-[10px] font-black uppercase text-[#8A9099] flex items-center gap-2 tracking-wider"><History className="w-3 h-3" /> {DICTIONARY[lang].ui.logs}</div>
           <button onClick={() => setIsOpen(false)} className="md:hidden"><X className="w-4 h-4 text-gray-400" /></button>
         </div>
         <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {logs.length === 0 && <div className="h-20 flex items-center justify-center text-xs text-gray-400 font-medium italic">{lang === 'ru' ? 'Игра началась' : 'Game Started'}</div>}
            {logs.map((log, i) => (
              <div key={i} className="text-xs px-3 py-2 rounded-xl hover:bg-gray-50 flex flex-col gap-1 border border-transparent hover:border-gray-100 transition-colors">
                 <div className="flex justify-between items-center">
                   <span className="font-bold text-[#1A1F26] truncate max-w-[120px]">{log.user}</span>
                   <span className="text-[9px] text-gray-400">{log.time}</span>
                 </div>
                 <span className="text-gray-600 leading-snug">{log.action}</span>
              </div>
            ))}
         </div>
      </div>
    </>
  );
};