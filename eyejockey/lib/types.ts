/**
 * @file types.ts
 * @description Shared TypeScript types used across the EyeJockey application.
 */

/** Status of the RSVP display during a teleprompter session. */
export type RSVPStatus = 'waiting' | 'synced' | 'offscript' | 'done';

/** WPM classification ranges for calibration feedback. */
export type WPMRange = 'too-slow' | 'good' | 'too-fast';

/** A single tokenised word from the original script. */
export interface WordToken {
  /** Zero-based position in the script word list. */
  index: number;
  /** The original word as it appears in the script (preserving case/punctuation). */
  original: string;
  /** Lowercase, stripped version used for fuzzy matching. */
  normalised: string;
  /** Trailing punctuation characters detected on this word (e.g. [','] or ['.', '!']). */
  punctuation: string[];
}

/** User-adjustable punctuation delay values keyed by punctuation character. */
export type DelaySettings = Record<string, number>;

/** Per-word lifecycle status in the RSVP engine. */
export type WordStatus = 'planned' | 'displayed' | 'confirmed' | 'unconfirmed';

/** Per-word state — the single source of truth for each script word. */
export interface WordState {
  token: WordToken;
  status: WordStatus;
  displayedAt: number | null;   // performance.now() when rAF first displayed this word
  confirmedAt: number | null;   // performance.now() when Deepgram confirmed this word
  confirmedWith: string | null; // the Deepgram word that matched
}

/** An off-script word spoken by the user (not in the script token array). */
export interface OffScriptEntry {
  word: string;
  timestamp: number;
  afterTokenIndex: number; // the confirmed index at the time this was spoken
}

/** A single entry in the live transcript feed. */
export interface TranscriptEntry {
  word: string;
  timestamp: number;
  isOffScript: boolean;
}

/** A word received from Deepgram with timing metadata. */
export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

/** State returned by the useRSVP hook. */
export interface RSVPState {
  currentWord: string;
  displayIndex: number;
  confirmedIndex: number;
  runway: string[];
  status: RSVPStatus;
  speedRatio: number;
  tokens: WordToken[];
  wordStates: WordState[];
  transcript: TranscriptEntry[];
  delayProgress: number | null;
  isDrifting: boolean;
}

/** State returned by the useDeepgram hook. */
export interface DeepgramState {
  finalWords: DeepgramWord[];
  interimTranscript: string;
  isConnected: boolean;
  error: string | null;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

/** State returned by the useMediaRecorder hook. */
export interface MediaRecorderState {
  isRecording: boolean;
  audioURL: string | null;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

/** State returned by the useLeadIn hook. */
export interface LeadInState {
  countdownValue: number | null;
  startLeadIn: (onComplete: () => void) => void;
}
