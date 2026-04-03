/**
 * @file useDelaySettings.ts
 * @description Manages per-punctuation delay settings with localStorage persistence.
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DelaySettings } from '@/lib/types';
import {
  PUNCTUATION_DELAYS,
  MAX_PUNCTUATION_DELAY,
  MIN_PUNCTUATION_DELAY,
  STORAGE_KEY_DELAY_SETTINGS,
} from '@/lib/constants';

export function useDelaySettings() {
  const [delays, setDelays] = useState<DelaySettings>({ ...PUNCTUATION_DELAYS });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_DELAY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored) as DelaySettings;
        setDelays((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELAY_SETTINGS, JSON.stringify(delays));
  }, [delays]);

  const setDelay = useCallback((punct: string, ms: number) => {
    const clamped = Math.max(MIN_PUNCTUATION_DELAY, Math.min(MAX_PUNCTUATION_DELAY, ms));
    setDelays((prev) => ({ ...prev, [punct]: clamped }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setDelays({ ...PUNCTUATION_DELAYS });
  }, []);

  return { delays, setDelay, resetToDefaults };
}
