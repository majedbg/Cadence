import { describe, it, expect } from 'vitest';
import { estimateSyllables } from './textUtils';

describe('estimateSyllables', () => {
  it('counts syllables in common words', () => {
    expect(estimateSyllables('to')).toBe(1);
    expect(estimateSyllables('reading')).toBe(2);
    expect(estimateSyllables('anatomically')).toBeGreaterThanOrEqual(5);
  });

  it('handles silent trailing e (hide, like)', () => {
    expect(estimateSyllables('hide')).toBe(1);
    expect(estimateSyllables('like')).toBe(1);
  });

  it('treats consonant-le as its own syllable (table, simple)', () => {
    expect(estimateSyllables('table')).toBe(2);
    expect(estimateSyllables('simple')).toBe(2);
  });

  it('returns at least 1 for any non-empty input', () => {
    expect(estimateSyllables('a')).toBe(1);
    expect(estimateSyllables('!')).toBe(1);
  });
});
