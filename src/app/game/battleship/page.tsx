'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BattleshipBoard from '@/components/battleship/BattleshipBoard';

export default function BattleshipGamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <Loader2 className="w-10 h-10 animate-spin text-[#9e1316]" />
        </div>
      }
    >
      <BattleshipBoard />
    </Suspense>
  );
}