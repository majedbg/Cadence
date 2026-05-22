import type { WordToken, DelaySettings } from './types';
import { PUNCTUATION_DELAYS, MAX_PUNCTUATION_DELAY } from './constants';

const PUNCT_CHARS = new Set(Object.keys(PUNCTUATION_DELAYS));
const TRAILING_PUNCT_RE = /[,.\;:—–…?!]+$/;

/**
 * Vowel-group syllable heuristic — same as the Cadence app.
 * "anatomically" gets more time than "to".
 */
export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 1;
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  if (w.endsWith('e') && count > 1) count--;
  if (/[^aeiouy]le$/.test(w)) count++;
  return Math.max(1, count);
}

export function extractPunctuation(word: string): string[] {
  const match = word.match(TRAILING_PUNCT_RE);
  if (!match) return [];
  const out: string[] = [];
  for (const ch of match[0]) if (PUNCT_CHARS.has(ch)) out.push(ch);
  return out;
}

export function computeDelayMs(token: WordToken, settings: DelaySettings): number {
  if (token.punctuation.length === 0) return 0;
  const total = Math.max(...token.punctuation.map((p) => settings[p] ?? 0));
  return Math.min(total, MAX_PUNCTUATION_DELAY);
}

/**
 * Per-word durations weighted by syllable count, normalised so the total
 * equals tokens.length * msPerWord. Preserves WPM budget while letting
 * long words breathe.
 */
export function computeWordDurations(tokens: WordToken[], targetWPM: number): number[] {
  const msPerWord = 60_000 / targetWPM;
  if (tokens.length === 0) return [];
  const totalSyllables = tokens.reduce((s, t) => s + t.syllables, 0);
  if (totalSyllables === 0) return tokens.map(() => msPerWord);
  const budget = tokens.length * msPerWord;
  return tokens.map((t) => (t.syllables / totalSyllables) * budget);
}
