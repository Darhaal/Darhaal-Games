'use client';

import React from 'react';

/**
 * The layout every board game shares: the play area on the left, a column of
 * cards on the right; on a phone the cards follow the play area.
 *
 * The bottom padding is room for the chat button — nothing interactive may
 * end up underneath it.
 */
export default function GameLayout({
  board, side, boardWidth = 600
}: {
  board: React.ReactNode;
  side: React.ReactNode;
  /** The widest the play area gets, in px. */
  boardWidth?: number;
}) {
  const width = { maxWidth: `min(92vw, ${boardWidth}px)` };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-6 md:pt-8 pb-24 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] items-start">
      <section className="flex justify-center min-w-0">
        <div className="w-full" style={width}>{board}</div>
      </section>
      <aside className="w-full mx-auto lg:!max-w-none space-y-4" style={width}>
        {side}
      </aside>
    </main>
  );
}
