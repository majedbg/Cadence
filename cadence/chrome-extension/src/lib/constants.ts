import type { DelaySettings, ReaderSettings } from './types';

export const DEFAULT_SETTINGS: ReaderSettings = {
  wpm: 300,
  highlightColor: '#FF6B00',
  highlightOpacity: 0.25,
  showRunway: true,
  autoOpenPdfs: false,
  wordFadeMs: 60,
};

export const RUNWAY_LENGTH = 6;

export const PUNCTUATION_DELAYS: DelaySettings = {
  ',': 150,
  '.': 350,
  ';': 250,
  ':': 250,
  '—': 300,
  '–': 250,
  '…': 500,
  '?': 400,
  '!': 300,
};

export const MAX_PUNCTUATION_DELAY = 1000;

export const STORAGE_KEY = 'cadence_reader_settings';
