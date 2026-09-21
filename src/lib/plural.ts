/**
 * Counted nouns.
 *
 * Russian picks one of three forms by the last digits of the number —
 * 1 фишка, 2 фишки, 5 фишек — and the teens are the exception that catches
 * every naive implementation: 11 takes the same form as 5, not as 1.
 */
export type RussianForms = readonly [one: string, few: string, many: string];

export function pluralRu(count: number, forms: RussianForms): string {
  const n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];

  const last = n % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** English needs only the two forms. */
export function pluralEn(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
