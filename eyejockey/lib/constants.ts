/**
 * @file constants.ts
 * @description Application-wide constants for EyeJockey: default scripts,
 *              calibration settings, WPM targets, and copy strings.
 */

import type { WPMRange } from './types';

/** Default script pre-filled in the script input textarea. */
export const DEFAULT_SCRIPT = `The quick brown fox jumps over the lazy dog. In a world filled with noise and distraction, the ability to communicate clearly is more valuable than ever. Whether you are presenting to an audience of thousands or recording a video for a handful of viewers, your words matter. A teleprompter helps you deliver those words with confidence, maintaining eye contact and natural pacing. EyeJockey was built to make that process seamless, intelligent, and adaptive to your unique speaking style.`;

/** Passage used during WPM calibration. */
export const CALIBRATION_PASSAGE = `The sun rose over the quiet town, casting long shadows across the empty streets. Birds began their morning chorus, filling the crisp air with melody. A gentle breeze rustled through the oak trees lining the main road, carrying the faint scent of fresh bread from the corner bakery. One by one, lights flickered on in the houses as the town slowly stirred to life.`;

/** Duration of the calibration recording in milliseconds. */
export const CALIBRATION_DURATION_MS = 10_000;

/** Default target WPM if calibration is skipped. */
export const WPM_TARGET = 150;

/** WPM thresholds for classification. */
export const WPM_SLOW_THRESHOLD = 120;
export const WPM_FAST_THRESHOLD = 180;

/** Countdown seconds before recording starts. */
export const LEAD_IN_SECONDS = 3;

/** Explanatory copy for each WPM classification range. */
export const WPM_EXPLANATIONS: Record<WPMRange, string> = {
  'too-slow':
    'You read at a relaxed pace. The teleprompter will advance slowly to keep up with you.',
  good: 'Great pace! This is a comfortable speaking speed for most audiences.',
  'too-fast':
    'You read quickly. The teleprompter will advance faster to stay in sync.',
};

/** Number of upcoming words to show in the RSVP runway when off-script. */
export const RUNWAY_LENGTH = 3;

/** SessionStorage keys. */
export const STORAGE_KEY_SCRIPT = 'eyejockey_script';
export const STORAGE_KEY_WPM = 'eyejockey_wpm';
