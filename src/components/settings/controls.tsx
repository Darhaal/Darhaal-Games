'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { LABEL } from '@/components/game/ui';

export const INPUT =
  'w-full min-w-0 bg-page border border-gray-200 focus:bg-surface focus:border-ink rounded-xl py-2.5 px-4 font-bold text-ink outline-none transition-all placeholder:text-gray-400 text-base sm:text-sm';

/** A section heading: the design-system label with its icon. */
export function SectionLabel({ icon: Icon, children, aside }: { icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h3 className={`${LABEL} flex items-center gap-2`}>
        <Icon className="w-3.5 h-3.5" /> {children}
      </h3>
      {aside}
    </div>
  );
}

/** A choice of two or three, as the segmented controls on /create draw it. */
export function Segmented<V extends string>({ label, value, options, onChange }: {
  label: string;
  value: V;
  options: readonly { value: V; label: string; icon?: LucideIcon }[];
  onChange: (v: V) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 p-1 bg-page border border-line rounded-xl"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ value: v, label: text, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg border text-xs sm:text-sm font-bold transition-all min-w-0 ${
              active
                ? 'bg-surface text-ink border-line shadow-sm'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : ''}`} />}
            <span className="truncate">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The toggle row of the design system: icon well that darkens when on, and a switch. */
export function ToggleRow({ icon: Icon, title, description, checked, disabled, onChange }: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 p-3 bg-page rounded-xl border border-transparent hover:border-gray-200 transition-all text-left disabled:opacity-50 disabled:hover:border-transparent"
    >
      <span className={`p-1.5 rounded-lg transition-colors shrink-0 ${checked ? 'bg-ink text-on-ink' : 'bg-gray-200 text-gray-500'}`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-ink text-sm leading-tight">{title}</span>
        {description && <span className="block mt-0.5 text-xs font-medium text-muted leading-snug">{description}</span>}
      </span>
      <span className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-ink' : 'bg-gray-200'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform shadow-sm ${checked ? 'translate-x-4 bg-on-ink' : 'bg-surface dark:bg-gray-500'}`} />
      </span>
    </button>
  );
}

/** A password field with the show/hide eye. */
export function PasswordInput({ id, value, onChange, autoComplete, showLabel, hideLabel }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`${INPUT} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? hideLabel : showLabel}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-ink transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

/** A short line under a form: what happened, in green or in red. */
export function FormNote({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mt-2 text-xs font-bold leading-snug ${tone === 'error' ? 'text-accent' : 'text-emerald-600'}`}
    >
      {children}
    </p>
  );
}
