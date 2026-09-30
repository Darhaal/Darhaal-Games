'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { articleUrl, fetchSummary, type ArticleSummary } from '@/lib/wikiler/wikipedia';
import type { WikilerLang } from '@/lib/gameLogic/wikiler';

/**
 * What the article was — shown once a round is over for a player, above the
 * opened article and in the results between rounds, so someone who missed it
 * sees it at a glance: the picture, a line of description, the first
 * paragraph, and the way to Wikipedia.
 */
export default function ArticlePreview({ wikiLang, title, label, openLabel, compact = false }: {
  wikiLang: WikilerLang;
  title: string;
  label: string;
  openLabel: string;
  compact?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ title: string; summary: ArticleSummary | null } | null>(null);
  const summary = loaded?.title === title ? loaded.summary : null;

  useEffect(() => {
    let cancelled = false;
    fetchSummary(wikiLang, title)
      .then((s) => { if (!cancelled) setLoaded({ title, summary: s }); })
      // No preview is fine: the title and the link below still say it.
      .catch(() => { if (!cancelled) setLoaded({ title, summary: null }); });
    return () => { cancelled = true; };
  }, [wikiLang, title]);

  const thumb = summary?.thumbnail;

  return (
    <div className="p-4 rounded-xl border border-[#E6E1DC] bg-[#F8FAFC] flex gap-4 animate-in fade-in duration-300">
      {thumb && (
        // A picture straight from Wikimedia Commons, of unknown size; next/image would proxy it through us.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb.source}
          alt=""
          className={`${compact ? 'w-16 h-16' : 'w-20 h-20 md:w-24 md:h-24'} shrink-0 rounded-lg object-cover border border-[#E6E1DC] bg-white`}
          loading="lazy"
        />
      )}
      <div className="min-w-0">
        <div className="text-2xs font-black text-[#8A9099] uppercase tracking-widest">{label}</div>
        <div className="text-xl font-black text-[#1A1F26] leading-tight mt-1">{summary?.title ?? title}</div>
        {summary?.description && <div className="text-xs font-bold text-[#8A9099] mt-0.5">{summary.description}</div>}
        {summary?.extract && (
          <p className={`text-sm text-[#1A1F26] leading-relaxed mt-2 ${compact ? 'line-clamp-3' : 'line-clamp-4'}`}>{summary.extract}</p>
        )}
        <a
          href={articleUrl(wikiLang, title)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#8A9099] hover:text-[#9e1316] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> {openLabel}
        </a>
      </div>
    </div>
  );
}
