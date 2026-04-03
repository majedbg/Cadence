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
  currentIndex: number;
  runway: string[];
  status: RSVPStatus;
  speedRatio: number;
  tokens: WordToken[];
  transcript: TranscriptEntry[];
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
