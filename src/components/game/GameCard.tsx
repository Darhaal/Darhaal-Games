'use client';

import React from 'react';
import { CARD, LABEL } from './ui';

/** A card in a game's side column, headed by a label and an optional aside. */
export default function GameCard({
  label, aside, className = '', children
}: {
  label?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${CARD} p-4 ${className}`}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className={LABEL}>{label}</span>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}
