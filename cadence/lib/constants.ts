/**
 * @file constants.ts
 * @description Application-wide constants for Cadence: default scripts,
 *              calibration settings, WPM targets, and copy strings.
 */

import type { WPMRange } from "./types";

/** Default script pre-filled in the script input textarea. */
export const DEFAULT_SCRIPT = `Most teleprompters scroll text past your eyes, making it obvious you are reading, but this one holds one word at a time directly beneath your camera, and advances over time, so that your eyes stay still to mimic eye-contact.
Another advantage is, if you fix the eye, reading stops feeling like a task and your attention can go to your voice and pacing.
Another feature of this teleprompter is that it listens while you speak and tracks which word you are on in real time, so the display follows your speed, and if you go off script, it holds its position. When you come back and it picks up exactly where you left off.
Before any session, it also clocks your natural reading speed and uses it as a baseline. Punctuation introduces real pauses — a comma gets a beat, a period gets a breath. These are adjustable, because no two people phrase things the same way.
Built for people who care about how their words land.`;
/** Passage used during WPM calibration. */
export const CALIBRATION_PASSAGE = `This telepromper will not scroll text past your eyes - it holds one word in one place, directly beneath your camera, and advances it at the pace you speak. Your eyes stay still. To anyone watching, you are simply looking at them.
Fix the eye, and reading stops being a task. Your attention goes back to your voice, your pacing, your audience.`;
/** Duration of the calibration recording in milliseconds. */
export const CALIBRATION_DURATION_MS = 10_000;

/** Default target WPM if calibration is skipped. */
export const WPM_TARGET = 140;

/** WPM thresholds for classification. */
export const WPM_SLOW_THRESHOLD = 120;
export const WPM_FAST_THRESHOLD = 180;

/** Countdown seconds before recording starts. */
export const LEAD_IN_SECONDS = 3;

/** Explanatory copy for each WPM classification range. */
export const WPM_EXPLANATIONS: Record<WPMRange, string> = {
  "too-slow":
    "You read at a relaxed pace. The teleprompter will advance slowly to keep up with you.",
  good: "Great pace! This is a comfortable speaking speed for most audiences.",
  "too-fast":
    "You read quickly. The teleprompter will advance faster to stay in sync.",
};

/** Number of upcoming words to show in the RSVP runway when off-script.
 *  Must be large enough to cover Deepgram's 1-3s confirmation lag.
 *  At 140 WPM (~2.3 words/sec), 8 words = ~3.5s of reading material —
 *  enough to keep reading while waiting for re-sync confirmation. */
export const RUNWAY_LENGTH = 8;

/** SessionStorage keys. */
export const STORAGE_KEY_SCRIPT = "cadence_script";
export const STORAGE_KEY_WPM = "cadence_wpm";
export const STORAGE_KEY_DELAY_SETTINGS = "cadence_delay_settings";

/**
 * PUNCTUATION_DELAYS — Default pause durations in milliseconds.
 * Applied AFTER the word preceding the punctuation is displayed.
 * Sourced from demo/explainer video production standards.
 */
export const PUNCTUATION_DELAYS: Record<string, number> = {
  ",": 200,
  ".": 400,
  ";": 300,
  ":": 300,
  "\u2014": 350, // em dash —
  "\u2013": 300, // en dash –
  "\u2026": 600, // ellipsis …
  "?": 450,
  "!": 300,
  "\u00B6": 700, // paragraph ¶
};

export const MAX_PUNCTUATION_DELAY = 1200;
export const MIN_PUNCTUATION_DELAY = 50;

/** Consecutive Deepgram mismatches before entering off-script status. */
export const OFFSCRIPT_THRESHOLD = 3;

/** Consecutive sequential matches required to re-sync from off-script.
 *  Prevents false re-sync from common words like "the", "it", "your". */
export const RESYNC_MATCH_THRESHOLD = 3;

/** Max words the display can advance beyond confirmed before triggering rewind.
 *  Deepgram's is_final batches lag 1-3s behind speech. At 140 WPM (~2.3 words/sec),
 *  10 words = ~4.3s grace — covers normal Deepgram latency while still catching
 *  off-script drift quickly. */
export const DRIFT_THRESHOLD = 10;

/** Milliseconds of silence (no new Deepgram words) before triggering rewind.
 *  Must exceed Deepgram's normal batch gap (1-2s). 4s means genuine silence. */
export const SILENCE_TIMEOUT_MS = 4000;

/** After rewind, place display this many words ahead of confirmed (buffer). */
export const REWIND_BUFFER = 2;

/** Throttle interval for flushing ref state to React state (ms). */
export const STATE_FLUSH_INTERVAL_MS = 100;
