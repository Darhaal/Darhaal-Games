import { describe, it, expect } from 'vitest';
import { GAME_OPTIONS, choicePreview, defaultOptionValues, offeredChoices, withOfferedChoices, type ChoiceOption } from '@/games/options';
import { createInitialState } from '@/games/initialState';
import type { TimlerState } from '@/types/timler';

/**
 * Timler's lobby: photos by default, paintings or both on request, and the
 * eras each of them has (docs/timler-spec.md, section 13).
 */

const options = GAME_OPTIONS.timler;
const option = (key: string) => options.find((o) => o.key === key) as ChoiceOption;
const eras = (medium: string) => offeredChoices(option('era'), { ...defaultOptionValues('timler'), medium }).map((c) => c.value);
const host = { id: 'host-1', name: 'Host', avatarUrl: '/avatar/host-1' };
const room = (values: Record<string, string | number>) =>
  createInitialState('timler', host, 20, { ...defaultOptionValues('timler'), ...values }) as TimlerState;

describe('Timler lobby options', () => {
  it('starts on photos', () => {
    expect(defaultOptionValues('timler').medium).toBe('photos');
    expect(room({}).settings.medium).toBe('photos');
  });

  it('offers each medium its own eras', () => {
    expect(eras('photos')).toEqual(['all', '1800-1899', '1900-1945', '1946-2000', 'since2001']);
    expect(eras('paintings')).toEqual(['all', 'before1600', '1600-1799', '1800-1899', '1900-1945']);
    expect(eras('both')).toEqual(['all', 'before1600', '1600-1799', '1800-1899', '1900-1945', '1946-2000', 'since2001']);
  });

  it('puts an era back to all time when the medium no longer has it', () => {
    const values = { ...defaultOptionValues('timler'), medium: 'paintings', era: 'before1600' };
    expect(withOfferedChoices(options, { ...values, medium: 'photos' }).era).toBe('all');
    expect(withOfferedChoices(options, { ...values, medium: 'both' }).era).toBe('before1600');
  });

  it('never opens a room on an era its medium has nothing from', () => {
    expect(room({ medium: 'paintings', era: 'since2001' }).settings.era).toBe('all');
    expect(room({ medium: 'paintings', era: '1600-1799' }).settings).toMatchObject({ medium: 'paintings', era: '1600-1799' });
    expect(room({ medium: 'nonsense' }).settings.medium).toBe('photos');
  });

  it('reads the 18+ setting: off, on, or only 18+', () => {
    expect(room({}).settings).toMatchObject({ adult: false, adultOnly: false });
    expect(room({ adult: 'on' }).settings).toMatchObject({ adult: true, adultOnly: false });
    expect(room({ adult: 'only' }).settings).toMatchObject({ adult: true, adultOnly: true });
  });

  it('previews an era for the medium chosen', () => {
    const nineteenth = option('era').choices.find((c) => c.value === '1800-1899')!;
    const preview = (medium: string) => choicePreview(nineteenth, { medium })!.en.join(' ');
    expect(preview('photos')).toMatch(/daguerreotypes/);
    expect(preview('photos')).not.toMatch(/Impressionism/);
    expect(preview('paintings')).toMatch(/Impressionism/);
    expect(preview('both')).toMatch(/daguerreotypes.*Impressionism/);
  });
});
