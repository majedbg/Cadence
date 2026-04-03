/**
 * @file SpeedMeter.tsx
 * @description Narrow centered speed indicator bar (~200px). Fill width maps
 *              speedRatio (0–2) to a percentage. Color shifts between blue (slow),
 *              green (good), and red (fast).
 */
'use client';

interface SpeedMeterProps {
  speedRatio: number;
}

function getFillColor(ratio: number): string {
  if (ratio < 0.75) return '#3B82F6';
  if (ratio <= 1.25) return '#22C55E';
  return '#EF4444';
}

export default function SpeedMeter({ speedRatio }: SpeedMeterProps) {
  const clampedWidth = Math.min(100, Math.max(0, speedRatio * 50));
  const color = getFillColor(speedRatio);

  return (
    <div
      className="fixed top-0 left-1/2 z-50"
      style={{
        transform: 'translateX(-50%)',
        width: '200px',
        height: '4px',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: '2px',
      }}
      role="meter"
      aria-valuenow={speedRatio}
      aria-valuemin={0}
      aria-valuemax={2}
      aria-label="Speaking speed"
    >
      <div
        style={{
          height: '100%',
          width: `${clampedWidth}%`,
          backgroundColor: color,
          borderRadius: '2px',
          transition: 'width 300ms ease, background-color 400ms ease',
        }}
      />
    </div>
  );
}
