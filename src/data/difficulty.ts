/**
 * How well known a game's material is — shared by Wikiler (articles) and
 * Timler (photos). The material is ranked by how known it is and cut in
 * thirds: the best known third is easy, the least known hard; `any` takes
 * all of it.
 */
export const DIFFICULTY_LEVELS = ['any', 'easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTIES: Record<Difficulty, { emoji: string; label: { ru: string; en: string; uk: string } }> = {
  any: { emoji: '🎲', label: { ru: 'Любая', en: 'Any', uk: 'Будь-яка' } },
  easy: { emoji: '🟢', label: { ru: 'Легко', en: 'Easy', uk: 'Легко' } },
  medium: { emoji: '🟡', label: { ru: 'Средне', en: 'Medium', uk: 'Середньо' } },
  hard: { emoji: '🔴', label: { ru: 'Сложно', en: 'Hard', uk: 'Складно' } }
};

/** The third of `items` a difficulty asks for, ranked by `fame` — most known first. */
export function byFame<T>(items: readonly T[], fame: (item: T) => number, difficulty: Difficulty): T[] {
  if (difficulty === 'any') return [...items];
  const ranked = [...items].sort((a, b) => fame(b) - fame(a));
  const third = Math.ceil(ranked.length / 3);
  const at = { easy: 0, medium: 1, hard: 2 }[difficulty];
  return ranked.slice(at * third, (at + 1) * third);
}
