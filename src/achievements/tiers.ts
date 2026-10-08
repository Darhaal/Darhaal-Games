import { ACHIEVEMENTS, type Achievement, type Text, type Tier } from './definitions';

/**
 * How the three tiers look. Medal colours are the one place the progress page
 * leaves the site's single accent — like seat colours on a board, they carry
 * meaning — and they stay muted: a tinted well and an icon, never a fill.
 */
export const TIER_STYLE: Record<Tier, { name: Text; well: string; icon: string; bar: string; dot: string }> = {
  bronze: {
    name: { ru: 'Бронза', en: 'Bronze', uk: 'Бронза' },
    well: 'bg-[#F6EDE4] border-[#E9D5C1] dark:bg-[#2A1E14] dark:border-[#4A3322]',
    icon: 'text-[#A0673A] dark:text-[#D29A6B]',
    bar: 'bg-[#A0673A]',
    dot: 'bg-[#A0673A]'
  },
  silver: {
    name: { ru: 'Серебро', en: 'Silver', uk: 'Срібло' },
    well: 'bg-[#EEF1F4] border-[#D9DEE5] dark:bg-[#1E242C] dark:border-[#38414C]',
    icon: 'text-[#6B7480] dark:text-[#A9B2BD]',
    bar: 'bg-[#8A939E]',
    dot: 'bg-[#8A939E]'
  },
  gold: {
    name: { ru: 'Золото', en: 'Gold', uk: 'Золото' },
    well: 'bg-[#FBF3DC] border-[#EEDCA6] dark:bg-[#2A2310] dark:border-[#4D3F17]',
    icon: 'text-[#A77B06] dark:text-[#E0B23C]',
    bar: 'bg-[#C99A2E]',
    dot: 'bg-[#C99A2E]'
  }
};

/** A stored id back to its achievement and tier: `wins:gold`, `coup.untouchable`. */
export function unlockOf(id: string): { achievement: Achievement; tier: Tier } | null {
  const colon = id.lastIndexOf(':');
  const baseId = colon === -1 ? id : id.slice(0, colon);
  const achievement = ACHIEVEMENTS.find((a) => a.id === baseId);
  if (!achievement) return null;
  if (achievement.kind === 'feat') return { achievement, tier: achievement.tier };
  const tier = id.slice(colon + 1) as Tier;
  return TIER_STYLE[tier] ? { achievement, tier } : null;
}
