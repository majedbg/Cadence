export type RSVPStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface WordToken {
  index: number;
  original: string;
  punctuation: string[];
  syllables: number;
  /** Range that covers exactly this word in the document. Lets us re-measure rects on scroll/resize. */
  range: Range;
}

export type DelaySettings = Record<string, number>;

export interface ReaderSettings {
  wpm: number;
  highlightColor: string;
  highlightOpacity: number;
  showRunway: boolean;
  /** When true, the background redirects PDF navigations into the Cadence viewer. */
  autoOpenPdfs: boolean;
}
