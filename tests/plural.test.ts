import { describe, it, expect } from 'vitest';
import { pluralEn, pluralRu } from '@/lib/plural';

const DISCS = ['фишка', 'фишки', 'фишек'] as const;

describe('pluralRu', () => {
  it('picks the singular for 1 and anything ending in 1', () => {
    expect(pluralRu(1, DISCS)).toBe('фишка');
    expect(pluralRu(21, DISCS)).toBe('фишка');
    expect(pluralRu(101, DISCS)).toBe('фишка');
  });

  it('picks the few form for 2-4 and anything ending in them', () => {
    for (const n of [2, 3, 4, 22, 33, 44, 64]) {
      expect(pluralRu(n, DISCS)).toBe('фишки');
    }
  });

  it('picks the many form for 5-9, 0 and the round numbers', () => {
    for (const n of [0, 5, 9, 20, 25, 100]) {
      expect(pluralRu(n, DISCS)).toBe('фишек');
    }
  });

  it('treats the teens as the exception they are', () => {
    // 11 looks like 1 and 12-14 look like 2-4, but all four take 'фишек'
    for (const n of [11, 12, 13, 14, 111, 112]) {
      expect(pluralRu(n, DISCS)).toBe('фишек');
    }
  });
});

describe('pluralEn', () => {
  it('uses the singular only for exactly one', () => {
    expect(pluralEn(1, 'disc', 'discs')).toBe('disc');
    expect(pluralEn(0, 'disc', 'discs')).toBe('discs');
    expect(pluralEn(2, 'disc', 'discs')).toBe('discs');
    expect(pluralEn(21, 'disc', 'discs')).toBe('discs');
  });
});
