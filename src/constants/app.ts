/**
 * Central application constants — the single source of truth for branding,
 * URLs and shared configuration. Nothing brand- or environment-specific
 * should be hardcoded elsewhere.
 */

/** Platform (product) name shown in the UI */
export const APP_NAME = 'Darhaal Games';

/** Legal entity that owns the platform */
export const COMPANY_NAME = 'Okhten Group LLC';

/** The studio's own site — okhten.com publishes the company under this URL */
export const COMPANY_URL = 'https://okhtengroup.com';

/**
 * The developer behind the platform. "Darhaal" is the handle, which is where
 * the name comes from. okhten.com publishes the same person as structured
 * data; `lib/seo.ts` reuses its ids so search engines join the two.
 */
export const AUTHOR = {
  name: { ru: 'Артем Охтень', en: 'Artem Okhten' },
  handle: 'Darhaal',
  url: 'https://okhten.com',
  github: 'https://github.com/Darhaal',
  linkedin: 'https://www.linkedin.com/in/artem-okhten'
} as const;

/** The public, read-only copy of the source */
export const SOURCE_URL = 'https://github.com/Darhaal/Darhaal-Games';

/** Copyright line used in footers */
export const COPYRIGHT = `© 2026 ${COMPANY_NAME}`;

/** Contact for commercial licensing (see LICENSE) */
export const CONTACT_EMAIL = 'artem@okhten.com';

/**
 * Canonical site URL (og-tags, hreflang, sitemap, auth redirect fallback).
 * Configure via NEXT_PUBLIC_SITE_URL; falls back to the production domain.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://games.okhten.com';

/** Short brand tagline — the default meta description and OG subtitle */
export const APP_TAGLINE = {
  ru: 'Настольные и логические игры онлайн с друзьями — бесплатно и без установки.',
  en: 'Board and logic games online with friends — free, no download.'
} as const;

/** Locale served at the bare path; Russian lives under /ru */
export const DEFAULT_LOCALE = 'en' as const;

/**
 * Default generated avatar for a given seed (user id, nickname, etc.).
 *
 * Served from our own `/avatar/[seed]` route rather than api.dicebear.com:
 * the seed is usually the Supabase user id, and sending those to a third
 * party on every render bought us nothing. The route renders the same DiceBear
 * artwork locally and is cached immutably.
 */
export const defaultAvatar = (seed: string) =>
  `/avatar/${encodeURIComponent(seed)}`;

/** Room code alphabet and length (must match the unique index expectations) */
export const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const ROOM_CODE_LENGTH = 6;

/** Generate a random room code */
export const generateRoomCode = () =>
  Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  ).join('');
