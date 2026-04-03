/**
 * @file WPMResultCard.tsx
 * @description Displays calibration WPM result with a gradient speed bar,
 *              color-coded accent, word count breakdown, and explanation.
 *              The gradient bar teaches the user the blue=slow / green=good / red=fast
 *              color language used by the SpeedMeter in the session screen.
 */
'use client';

import type { WPMRange } from '@/lib/types';
import { WPM_EXPLANATIONS, WPM_SLOW_THRESHOLD, WPM_FAST_THRESHOLD } from '@/lib/constants';

interface WPMResultCardProps {
  wpm: number;
  range: WPMRange;
  wordCount: number;
  durationSeconds: number;
}

const RANGE_COLORS: Record<WPMRange, string> = {
  'too-slow': '#3B82F6',
  good: '#22C55E',
  'too-fast': '#EF4444',
};

// The bar represents 60–240 WPM range
const BAR_MIN = 60;
const BAR_MAX = 240;

function wpmToPercent(wpm: number): number {
  return Math.max(0, Math.min(100, ((wpm - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100));
}

export default function WPMResultCard({ wpm, range, wordCount, durationSeconds }: WPMResultCardProps) {
  const accentColor = RANGE_COLORS[range];
  const explanation = WPM_EXPLANATIONS[range];

  const userPos = wpmToPercent(wpm);
  const slowPos = wpmToPercent(WPM_SLOW_THRESHOLD);
  const fastPos = wpmToPercent(WPM_FAST_THRESHOLD);

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
        className="text-7xl font-bold mb-2"
        style={{ color: accentColor }}
      >
        {Math.round(wpm)}
      </p>

      {/* Word count breakdown */}
      <p
        className="text-sm mb-6"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{wordCount}</span> words
        {' '}in{' '}
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{durationSeconds}s</span>
        {' '}= {wordCount} &times; (60 / {durationSeconds}) ={' '}
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{Math.round(wpm)} WPM</span>
      </p>

      {/* Speed gradient bar */}
      <div className="mb-6 px-2">
        {/* Marker + user's WPM indicator */}
        <div className="relative" style={{ height: '28px' }}>
          {/* User position indicator (triangle + value) */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `${userPos}%`,
              transform: 'translateX(-50%)',
              bottom: 0,
            }}
          >
            <span
              className="text-xs font-bold mb-0.5"
              style={{ color: accentColor }}
            >
              {Math.round(wpm)}
            </span>
            <span
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `6px solid ${accentColor}`,
              }}
            />
          </div>
        </div>

        {/* Gradient bar */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{ height: '8px' }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(to right,
                #3B82F6 0%,
                #3B82F6 ${slowPos}%,
                #22C55E ${slowPos}%,
                #22C55E ${fastPos}%,
                #EF4444 ${fastPos}%,
                #EF4444 100%)`,
            }}
          />
        </div>

        {/* Range labels with boundary markers */}
        <div className="relative" style={{ height: '24px' }}>
          {/* Slow threshold marker */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `${slowPos}%`,
              transform: 'translateX(-50%)',
              top: '4px',
            }}
          >
            <span
              className="text-[10px] tabular-nums"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {WPM_SLOW_THRESHOLD}
            </span>
          </div>

          {/* Fast threshold marker */}
          <div
            className="absolute flex flex-col items-center"
            style={{
              left: `${fastPos}%`,
              transform: 'translateX(-50%)',
              top: '4px',
            }}
          >
            <span
              className="text-[10px] tabular-nums"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {WPM_FAST_THRESHOLD}
            </span>
          </div>
        </div>

        {/* Zone labels */}
        <div className="flex justify-between mt-0">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#3B82F6' }}>
            Slow
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#22C55E' }}>
            Good
          </span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#EF4444' }}>
            Fast
          </span>
        </div>
      </div>

      <p
        className="text-base leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {explanation}
      </p>
    </div>
  );
}
