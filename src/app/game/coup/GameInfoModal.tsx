'use client';

import React from 'react';
import { X, Info } from 'lucide-react';
import { DICTIONARY, Lang, getRoleIcon } from './GameConstants';

interface ModalProps {
  lang: Lang;
  onClose: () => void;
}

export const GameInfoModal: React.FC<ModalProps> = ({ lang, onClose }) => {
  const t = DICTIONARY[lang];

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] max-w-lg w-full max-h-[85vh] overflow-y-auto relative shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-6 h-6 text-gray-400" />
        </button>

        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#9E1316] p-2 rounded-xl text-white">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">{t.rules.title}</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <p className="font-bold text-[#1A1F26]">{t.rules.goal}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{t.rules.mechanics}</p>
            </div>

            <div className="space-y-3">
              {Object.entries(t.roles).map(([key, role]: any) => {
                const Icon = getRoleIcon(key);
                return (
                  <div key={key} className="flex gap-4 p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className="mt-1" style={{ color: role.color }}><Icon className="w-6 h-6" /></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black uppercase text-xs" style={{ color: role.color }}>{role.name}</span>
                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full font-bold text-gray-400">{role.action}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-snug">{role.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};