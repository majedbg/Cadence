/**
 * @file useLeadIn.ts
 * @description Hook providing a 3-2-1 countdown before recording begins.
 *              Exposes the current countdown value (or null) and a function
 *              to trigger the sequence with a completion callback.
 */
'use client';

import { useState, useRef, useCallback } from 'react';
import { LEAD_IN_SECONDS } from '@/lib/constants';

interface UseLeadInReturn {
  countdownValue: number | null;
  startLeadIn: (onComplete: () => void) => void;
}

export function useLeadIn(): UseLeadInReturn {
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLeadIn = useCallback((onComplete: () => void) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    let remaining = LEAD_IN_SECONDS;
    setCountdownValue(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdownValue(null);
        onComplete();
      } else {
        setCountdownValue(remaining);
      }
    }, 1000);
  }, []);

  return { countdownValue, startLeadIn };
}
