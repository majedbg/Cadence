/**
 * @file textUtils.ts
 * @description Text processing utilities: tokenisation, WPM calculation,
 *              classification, normalisation, and script merging.
 */

import type { WordToken, WordState, OffScriptEntry, WPMRange, DeepgramWord, TranscriptEntry, DelaySettings } from './types';
import { WPM_SLOW_THRESHOLD, WPM_FAST_THRESHOLD, PUNCTUATION_DELAYS, MAX_PUNCTUATION_DELAY } from './constants';

/**
 * Normalise a word for fuzzy matching: lowercase, strip punctuation.
 */
export function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const PUNCT_CHARS = new Set(Object.keys(PUNCTUATION_DELAYS));
const TRAILING_PUNCT_RE = /[,.\;:\u2014\u2013\u2026?!]+$/;

/**
 * Tokenise a script string into an array of WordToken objects.
 * Detects trailing punctuation and stores it on each token for delay computation.
 */
export function tokenise(script: string): WordToken[] {
  return script
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word, index) => {
      const match = word.match(TRAILING_PUNCT_RE);
      const punctuation: string[] = [];
      if (match) {
        for (const ch of match[0]) {
          if (PUNCT_CHARS.has(ch)) punctuation.push(ch);
        }
      }
      return {
        index,
        original: word,
        normalised: normalise(word),
        punctuation,
      };
    });
}

/**
 * Compute the punctuation delay for a token using current delay settings.
 * Takes the max delay among all trailing punctuation chars, capped at MAX_PUNCTUATION_DELAY.
 */
export function computeDelayMs(token: WordToken, settings: DelaySettings): number {
  if (token.punctuation.length === 0) return 0;
  const total = Math.max(...token.punctuation.map((p) => settings[p] ?? 0));
  return Math.min(total, MAX_PUNCTUATION_DELAY);
}

/**
 * Calculate words-per-minute from a word count and elapsed milliseconds.
 */
export function calculateWPM(wordCount: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (wordCount / elapsedMs) * 60_000;
}

/**
 * Classify a WPM value into a named range.
 */
export function classifyWPM(wpm: number): WPMRange {
  if (wpm < WPM_SLOW_THRESHOLD) return 'too-slow';
  if (wpm > WPM_FAST_THRESHOLD) return 'too-fast';
  return 'good';
}

/**
 * Find the best matching script index for a spoken word, searching forward
 * from the current position. Returns -1 if no match found within lookahead.
 */
export function findMatchIndex(
  tokens: WordToken[],
  spokenWord: string,
  fromIndex: number,
  lookahead: number = 10
): number {
  const norm = normalise(spokenWord);
  const end = Math.min(fromIndex + lookahead, tokens.length);
  for (let i = fromIndex; i < end; i++) {
    if (tokens[i].normalised === norm) return i;
  }
  return -1;
}

/**
 * Merge original script tokens with a live transcript to produce an annotated
 * transcript with off-script detection.
 */
export function mergedScript(
  tokens: WordToken[],
  transcript: TranscriptEntry[]
): TranscriptEntry[] {
  return transcript.map((entry) => {
    const norm = normalise(entry.word);
    const isInScript = tokens.some((t) => t.normalised === norm);
    return { ...entry, isOffScript: !isInScript };
  });
}

/**
 * Build a transcript entry array from Deepgram final words, marking
 * each word as on-script or off-script relative to the token list.
 */
export function buildTranscript(
  finalWords: DeepgramWord[],
  tokens: WordToken[]
): TranscriptEntry[] {
  let scriptIndex = 0;
  return finalWords.map((dw) => {
    const matchIdx = findMatchIndex(tokens, dw.word, scriptIndex);
    const isOffScript = matchIdx === -1;
    if (!isOffScript) {
      scriptIndex = matchIdx + 1;
    }
    return {
      word: dw.word,
      timestamp: dw.start,
      isOffScript,
    };
  });
}

/**
 * Derive a unified transcript from word states and off-script entries,
 * sorted by timestamp. Used as the single source of truth for TranscriptPanel.
 */
export function deriveTranscript(
  wordStates: WordState[],
  offScriptEntries: OffScriptEntry[]
): TranscriptEntry[] {
  const confirmed: TranscriptEntry[] = wordStates
    .filter((ws) => ws.status === 'confirmed' && ws.confirmedAt !== null)
    .map((ws) => ({
      word: ws.confirmedWith ?? ws.token.original,
      timestamp: ws.confirmedAt!,
      isOffScript: false,
    }));

  const offScript: TranscriptEntry[] = offScriptEntries.map((e) => ({
    word: e.word,
    timestamp: e.timestamp,
    isOffScript: true,
  }));

  return [...confirmed, ...offScript].sort((a, b) => a.timestamp - b.timestamp);
}
