/**
 * @file SpeedMeter.tsx
 * @description Fixed top-bar speed indicator. Fill width maps speedRatio (0–2)
 *              to a percentage (1.0 = 50% fill). Color shifts between blue (slow),
 *              green (good), and red (fast) zones.
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
      className="fixed top-0 left-0 z-50 w-full"
      style={{ height: '10px', backgroundColor: 'rgba(255,255,255,0.03)' }}
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
          transition: 'width 300ms ease, background-color 400ms ease',
        }}
      />
    </div>
  );
}
