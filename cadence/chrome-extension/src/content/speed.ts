/**
 * Pure helpers for the YouTube-style playback speed multiplier.
 *
 * Multiplier is clamped to [0.5, 3.5] and quantised to 1 decimal place so the
 * display never shows floating-point garbage like 1.30000000001.
 */

export const MIN_MULTIPLIER = 0.5;
export const MAX_MULTIPLIER = 3.5;
export const MULTIPLIER_STEP = 0.1;

/**
 * Round to one decimal place and clamp to [MIN_MULTIPLIER, MAX_MULTIPLIER].
 */
export function clampMultiplier(m: number): number {
  if (!Number.isFinite(m)) return 1.0;
  const rounded = Math.round(m * 10) / 10;
  if (rounded < MIN_MULTIPLIER) return MIN_MULTIPLIER;
  if (rounded > MAX_MULTIPLIER) return MAX_MULTIPLIER;
  return rounded;
}

/**
 * Step the multiplier up or down by 0.1, then clamp.
 * Rounds the input first so 1.0000001 + 0.1 → 1.1 (not 1.1000001).
 */
export function stepMultiplier(current: number, direction: 1 | -1): number {
  const normalised = Math.round(current * 10) / 10;
  return clampMultiplier(normalised + direction * MULTIPLIER_STEP);
}

/**
 * Format a multiplier for display, e.g. 1 → "1.0×", 2.3 → "2.3×".
 */
export function formatMultiplier(m: number): string {
  return `${m.toFixed(1)}×`;
}
