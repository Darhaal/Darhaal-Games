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
    <div role="dialog" aria-modal="true" aria-label={rules.title} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/20 backdrop-blur-xl animate-in fade-in duration-300 font-sans" onClick={onClose}>
      <div
        className="bg-surface rounded-[32px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-surface/50 relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-divider flex justify-between items-center bg-surface/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-page rounded-2xl border border-line flex items-center justify-center text-accent">
                <BookOpen className="w-6 h-6" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-ink uppercase tracking-tight">{rules.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                   <p className="text-xs font-bold text-muted uppercase tracking-widest">{rules.description}</p>
                </div>
             </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-full hover:bg-warm transition-colors text-muted hover:text-ink"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
           {/* Sidebar */}
           <div className="w-64 bg-page border-r border-divider p-4 flex flex-col gap-2 overflow-y-auto hidden md:flex">
              {rules.sections.map((section, idx) => {
                 const isActive = activeTab === idx;
                 const Icon = section.icon || ChevronRight;
                 return (
                    <button
                       key={idx}
                       onClick={() => setActiveTab(idx)}
                       className={`
                          flex items-center gap-3 p-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-left group relative overflow-hidden
                          ${isActive ? 'bg-surface text-ink shadow-md shadow-black/5 ring-1 ring-line' : 'text-muted hover:text-ink hover:bg-surface/50'}
                       `}
                    >
                       <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
                       <span className="relative z-10">{section.title}</span>
                       {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-full" />}
                    </button>
                 );
              })}
           </div>

           {/* Main Area */}
           <div className="flex-1 bg-surface p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 key={activeTab}">
                 <h3 className="text-2xl font-black text-ink mb-6 flex items-center gap-3">
                    <span className="text-line">0{activeTab + 1}.</span> {rules.sections[activeTab].title}
                 </h3>

                 {rules.sections[activeTab].type === 'list' && Array.isArray(rules.sections[activeTab].content) ? (
                    <ul className="grid gap-3">
                       {(rules.sections[activeTab].content as string[]).map((item, i) => (
                          <li key={i} className="flex gap-4 p-4 rounded-2xl border border-divider bg-page/50 hover:border-line transition-colors">
                             <div className="w-5 h-5 rounded-full border-2 border-line flex items-center justify-center shrink-0 mt-0.5 text-2xs font-black text-muted bg-surface">
                                {i + 1}
                             </div>
                             <span className="text-sm font-medium text-ink leading-relaxed">{item}</span>
                          </li>
                       ))}
                    </ul>
                 ) : (
                    <div className="p-6 rounded-3xl bg-page border border-divider text-ink leading-relaxed font-medium">
                       {rules.sections[activeTab].content}
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Footer Mobile Nav */}
        <div className="md:hidden p-4 border-t border-divider bg-surface flex gap-2 overflow-x-auto no-scrollbar">
           {rules.sections.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap px-4 ${i === activeTab ? 'bg-ink text-on-ink' : 'bg-page text-muted'}`}
              >
                 {rules.sections[i].title}
              </button>
           ))}
        </div>
      </div>
    </div>
  );
}