import type { Locale } from '@/games/registry';
import type { VersionType } from '@/constants/version';

/**
 * Copy for the changelog page (/changelog, /en/changelog). The versions
 * themselves live in `src/constants/version.ts` and `versionLegacy.ts`.
 */
export const CHANGELOG_COPY = {
  ru: {
    metaTitle: 'История изменений',
    metaDescription:
      'Все версии Darhaal Games с датами: новые игры, функции и исправления — от запуска в январе 2026 года до сегодняшнего дня.',
    title: 'История изменений',
    lead: 'Все версии Darhaal Games с датами — что появилось и что исправлено, от запуска в январе 2026 года до сегодняшнего дня.',
    current: 'Сейчас',
    count: ['версия', 'версии', 'версий'] as const,
    lines: 'Линейки',
    major: (n: number) => `Версия ${n}`,
    fixed: 'Исправлено',
    types: {
      init: 'Запуск',
      major: 'Большое обновление',
      minor: 'Обновление',
      patch: 'Патч'
    } satisfies Record<VersionType, string>
  },
  en: {
    metaTitle: 'Changelog',
    metaDescription:
      'Every Darhaal Games version with its date: new games, features and fixes — from the launch in January 2026 to today.',
    title: 'Changelog',
    lead: 'Every Darhaal Games version with its date — what came and what was fixed, from the launch in January 2026 to today.',
    current: 'Now',
    count: ['version', 'versions'] as const,
    lines: 'Release lines',
    major: (n: number) => `Version ${n}`,
    fixed: 'Fixed',
    types: {
      init: 'Launch',
      major: 'Major update',
      minor: 'Update',
      patch: 'Patch'
    } satisfies Record<VersionType, string>
  }
} satisfies Record<Locale, unknown>;
