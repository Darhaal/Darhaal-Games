'use client';

import React, { useState } from 'react';
import { X, BookOpen, ChevronRight } from 'lucide-react';
import { useEscape } from '@/hooks/useEscape';

export type RuleSectionType = 'text' | 'list' | 'key-value';

export interface RuleSection {
  title: string;
  icon?: React.ElementType;
  content: string | string[];
  type?: RuleSectionType;
}

export interface GameRulesData {
  title: string;
  description: string;
  sections: RuleSection[];
}

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: GameRulesData;
  themeColor?: string;
}

export default function GameRulesModal({ isOpen, onClose, rules }: GameRulesModalProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Close on Escape
  useEscape(isOpen, onClose);

  if (!isOpen || !rules) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={rules.title} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1A1F26]/20 backdrop-blur-xl animate-in fade-in duration-300 font-sans" onClick={onClose}>
      <div
        className="bg-white rounded-[32px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-white/50 relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#F1F5F9] flex justify-between items-center bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-[#F8FAFC] rounded-2xl border border-[#E6E1DC] flex items-center justify-center text-[#9e1316]">
                <BookOpen className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-[#1A1F26] uppercase tracking-tight">{rules.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#9e1316]" />
                   <p className="text-xs font-bold text-[#8A9099] uppercase tracking-widest">{rules.description}</p>
                </div>
             </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-full hover:bg-[#F5F5F0] transition-colors text-[#8A9099] hover:text-[#1A1F26]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
           {/* Sidebar */}
           <div className="w-64 bg-[#F8FAFC] border-r border-[#F1F5F9] p-4 flex flex-col gap-2 overflow-y-auto hidden md:flex">
              {rules.sections.map((section, idx) => {
                 const isActive = activeTab === idx;
                 const Icon = section.icon || ChevronRight;
                 return (
                    <button
                       key={idx}
                       onClick={() => setActiveTab(idx)}
                       className={`
                          flex items-center gap-3 p-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left group relative overflow-hidden
                          ${isActive ? 'bg-white text-[#1A1F26] shadow-md shadow-black/5 ring-1 ring-[#E6E1DC]' : 'text-[#8A9099] hover:text-[#1A1F26] hover:bg-white/50'}
                       `}
                    >
                       <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#9e1316]' : 'text-[#8A9099] group-hover:text-[#1A1F26]'}`} />
                       <span className="relative z-10">{section.title}</span>
                       {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#9e1316] rounded-r-full" />}
                    </button>
                 );
              })}
           </div>

           {/* Main Area */}
           <div className="flex-1 bg-white p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 key={activeTab}">
                 <h3 className="text-2xl font-black text-[#1A1F26] mb-6 flex items-center gap-3">
                    <span className="text-[#E6E1DC]">0{activeTab + 1}.</span> {rules.sections[activeTab].title}
                 </h3>

                 {rules.sections[activeTab].type === 'list' && Array.isArray(rules.sections[activeTab].content) ? (
                    <ul className="grid gap-3">
                       {(rules.sections[activeTab].content as string[]).map((item, i) => (
                          <li key={i} className="flex gap-4 p-4 rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC]/50 hover:border-[#E6E1DC] transition-colors">
                             <div className="w-5 h-5 rounded-full border-2 border-[#E6E1DC] flex items-center justify-center shrink-0 mt-0.5 text-2xs font-black text-[#8A9099] bg-white">
                                {i + 1}
                             </div>
                             <span className="text-sm font-medium text-[#1A1F26] leading-relaxed">{item}</span>
                          </li>
                       ))}
                    </ul>
                 ) : (
                    <div className="p-6 rounded-3xl bg-[#F8FAFC] border border-[#F1F5F9] text-[#1A1F26] leading-relaxed font-medium">
                       {rules.sections[activeTab].content}
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Footer Mobile Nav */}
        <div className="md:hidden p-4 border-t border-[#F1F5F9] bg-white flex gap-2 overflow-x-auto no-scrollbar">
           {rules.sections.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap px-4 ${i === activeTab ? 'bg-[#1A1F26] text-white' : 'bg-[#F8FAFC] text-[#8A9099]'}`}
              >
                 {rules.sections[i].title}
              </button>
           ))}
        </div>
      </div>
    </div>
  );
}