import type { Locale } from '@/games/registry';
import { APP_VERSION, VERSION_HISTORY, formatReleaseDate, formatReleaseRange, type VersionLog, type VersionType } from '@/constants/version';
import { LEGACY_HISTORY } from '@/constants/versionLegacy';
import { CHANGELOG_COPY } from '@/content/changelog';
import { pluralEn, pluralRu } from '@/lib/plural';
import { breadcrumbJsonLd } from '@/lib/seo';
import PublicShell from './PublicShell';
import JsonLd from './JsonLd';

/**
 * The full changelog, shared by /changelog and /en/changelog: every version
 * from 1.0.0 on, grouped by release line (2.12, 2.11…) under its major, each
 * with its date, what it brought and what it fixed.
 *
 * A server component like the rest of the public tree — readable without
 * JavaScript, and the only place the 1.x line is loaded.
 */

/** The same colours as the version timeline in the app's footer. */
const DOT: Record<VersionType, string> = {
  init: 'bg-purple-500',
  major: 'bg-[#9e1316]',
  minor: 'bg-blue-500',
  patch: 'bg-emerald-500'
};

interface Line {
  /** "2.12" */
  key: string;
  major: number;
  entries: VersionLog[];
}

/** Versions grouped by release line, newest first, in the order they come. */
function releaseLines(history: readonly VersionLog[]): Line[] {
  const lines: Line[] = [];
  for (const log of history) {
    const [major, minor] = log.ver.split('.');
    const key = `${major}.${minor}`;
    const last = lines[lines.length - 1];
    if (last?.key === key) last.entries.push(log);
    else lines.push({ key, major: Number(major), entries: [log] });
  }
  return lines;
}

const anchor = (ver: string) => `v${ver.replaceAll('.', '-')}`;

export default function Changelog({ locale }: { locale: Locale }) {
  const t = CHANGELOG_COPY[locale];
  const history = [...VERSION_HISTORY, ...LEGACY_HISTORY];
  const lines = releaseLines(history);
  const majors = [...new Set(lines.map((l) => l.major))];
  const count = history.length;
  const countWord = locale === 'ru' ? pluralRu(count, CHANGELOG_COPY.ru.count) : pluralEn(count, ...CHANGELOG_COPY.en.count);

  return (
    <PublicShell locale={locale}>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: t.title, path: '/changelog' }])} />

      <article className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[#1A1F26]">{t.title}</h1>
        <p className="mt-4 text-base text-gray-600 leading-relaxed">{t.lead}</p>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#8A9099]">
          {t.current}: {APP_VERSION} · {formatReleaseDate(history[0].date, locale)} · {count} {countWord}
        </p>

        <nav aria-label={t.lines} className="mt-8 flex flex-wrap gap-2">
          {lines.map((line) => (
            <a
              key={line.key}
              href={`#${anchor(line.key)}`}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#E6E1DC] text-xs font-bold text-[#1A1F26] tabular-nums hover:border-[#9e1316]/30 hover:text-[#9e1316] transition-colors"
            >
              {line.key}
            </a>
          ))}
        </nav>

        {majors.map((major) => (
          <section key={major} className="mt-14">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[#1A1F26]">{t.major(major)}</h2>

            <div className="mt-6 space-y-6">
              {lines.filter((line) => line.major === major).map((line) => {
                const newest = line.entries[0];
                const oldest = line.entries[line.entries.length - 1];
                const title = line.entries.find((e) => e.title)?.title;
                const range = formatReleaseRange(oldest.date, newest.date, locale);

                return (
                  <section
                    key={line.key}
                    id={anchor(line.key)}
                    className="bg-white rounded-2xl border border-[#E6E1DC] shadow-sm overflow-hidden scroll-mt-24"
                  >
                    <header className="px-5 md:px-7 pt-5 md:pt-6 pb-4 border-b border-[#F1F5F9] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="text-2xl font-black tabular-nums text-[#1A1F26]">{line.key}</span>
                        {title && <h3 className="text-lg font-black text-[#1A1F26] truncate">{title[locale]}</h3>}
                      </div>
                      <span className="text-2xs font-black uppercase tracking-widest text-[#8A9099]">{range}</span>
                    </header>

                    <ol className="divide-y divide-[#F1F5F9]">
                      {line.entries.map((log) => (
                        <li key={log.ver} id={anchor(log.ver)} className="px-5 md:px-7 py-5 scroll-mt-24">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-black tabular-nums text-[#1A1F26]">{log.ver}</span>
                            <span className="inline-flex items-center gap-1.5 text-2xs font-black uppercase tracking-widest text-[#8A9099]">
                              <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${DOT[log.type]}`} />
                              {t.types[log.type]}
                            </span>
                            <time dateTime={log.date} className="ml-auto text-2xs font-bold uppercase tracking-wider text-[#8A9099]">
                              {formatReleaseDate(log.date, locale)}
                            </time>
                          </div>

                          {log.desc && (
                            <p className="mt-2 text-sm md:text-base text-gray-600 leading-relaxed">{log.desc[locale]}</p>
                          )}

                          {log.fixes && (
                            <div className="mt-3">
                              <div className="text-2xs font-black uppercase tracking-widest text-[#8A9099]">{t.fixed}</div>
                              <ul className="mt-2 space-y-1.5">
                                {log.fixes[locale].map((fix) => (
                                  <li key={fix} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                                    <span aria-hidden className="mt-2 w-1 h-1 rounded-full bg-[#9e1316]/60 shrink-0" />
                                    <span>{fix}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                );
              })}
            </div>
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
