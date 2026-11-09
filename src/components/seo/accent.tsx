import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The public pages' red: one phrase of a headline, a short bar over each
 * section heading and a light call-to-action panel. Shared by the landing,
 * the /games hub and the game pages so they read as one site — before
 * these, everything on them but the buttons was black and grey.
 */

/** `text` with `phrase` in the accent colour, or the plain text when the phrase is not in it. */
export function Accented({ text, phrase }: { text: string; phrase: string }) {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-accent">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}

/** The first child of a section's h2: a short red bar above the title. */
export function SectionMark() {
  return <span aria-hidden className="block w-8 h-1 rounded-full bg-accent mb-4" />;
}

/** The closing "play" panel: light with a red tint, so the page does not end on a dark slab. */
export function CtaPanel({
  title,
  text,
  href,
  button,
  nofollow = false
}: {
  title: ReactNode;
  text: string;
  href: string;
  button: string;
  nofollow?: boolean;
}) {
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-[28px] px-8 py-10 md:px-12 md:py-14 text-center">
      <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-ink">{title}</h2>
      <p className="mt-3 text-sm md:text-base text-muted font-medium max-w-xl mx-auto">{text}</p>
      <Link
        href={href}
        rel={nofollow ? 'nofollow' : undefined}
        className="inline-block mt-7 bg-accent text-white text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full shadow-lg shadow-accent/20 hover:bg-ink hover:text-on-ink transition-colors"
      >
        {button}
      </Link>
    </div>
  );
}
