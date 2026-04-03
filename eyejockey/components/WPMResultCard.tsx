/**
 * @file WPMResultCard.tsx
 * @description Displays calibration or session WPM result with color-coded
 *              accent and an explanation pulled from WPM_EXPLANATIONS.
 */
'use client';

import type { WPMRange } from '@/lib/types';
import { WPM_EXPLANATIONS } from '@/lib/constants';

interface WPMResultCardProps {
  wpm: number;
  range: WPMRange;
}

const RANGE_COLORS: Record<WPMRange, string> = {
  'too-slow': '#3B82F6',
  good: '#22C55E',
  'too-fast': '#EF4444',
};

export default function WPMResultCard({ wpm, range }: WPMResultCardProps) {
  const accentColor = RANGE_COLORS[range];
  const explanation = WPM_EXPLANATIONS[range];

  return (
    <div
      className="mx-auto max-w-md rounded-xl p-8 text-center"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <p
        className="text-sm font-medium uppercase tracking-widest mb-2"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        Your WPM
      </p>
      <p
        className="text-7xl font-bold mb-4"
        style={{ color: accentColor }}
      >
        {Math.round(wpm)}
      </p>
      <p
        className="text-base leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {explanation}
      </p>
    </div>
  );
}
