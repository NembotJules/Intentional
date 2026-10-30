import { describe, expect, it } from 'vitest';
import { PILLAR_ICON_KEYS, customEmoji, firstEmoji, resolvePillarIconKey } from './pillarIcons';

describe('pillar icons', () => {
  it('has money glyphs, and every key is unique', () => {
    for (const k of ['wallet', 'piggybank', 'banknote', 'coins', 'trending', 'landmark']) expect(PILLAR_ICON_KEYS).toContain(k);
    expect(new Set(PILLAR_ICON_KEYS).size).toBe(PILLAR_ICON_KEYS.length);
  });

  it('guesses a glyph from the pillar name', () => {
    expect(resolvePillarIconKey('', 'Finances')).toBe('wallet');
    expect(resolvePillarIconKey('', 'Savings')).toBe('piggybank');
    expect(resolvePillarIconKey('', 'Investing')).toBe('trending');
    expect(resolvePillarIconKey('', 'Faith')).toBe('church');
    expect(resolvePillarIconKey('', 'Travel')).toBe('plane');
    expect(resolvePillarIconKey('', 'Health')).toBe('dumbbell');
    expect(resolvePillarIconKey('', 'Zzz')).toBe('target');
  });

  it('keeps a picked key, maps known emoji, and draws any other emoji as itself', () => {
    expect(resolvePillarIconKey('coins', 'Body')).toBe('coins');
    expect(resolvePillarIconKey('💰')).toBe('wallet');
    expect(customEmoji('💰')).toBeNull();
    expect(customEmoji('coins')).toBeNull();
    expect(customEmoji('cash-outline')).toBeNull();
    expect(customEmoji('🧗')).toBe('🧗');
  });

  it('takes the first emoji of what was typed', () => {
    expect(firstEmoji('🧗‍♂️ climbing')).toBe('🧗‍♂️');
    expect(firstEmoji('hi ⛵')).toBe('⛵');
    expect(firstEmoji('abc')).toBeNull();
  });
});
