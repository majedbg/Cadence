/**
 * @file DelayBar.tsx
 * @description Shrinking bar beneath the RSVP word during punctuation delays.
 *              Driven by rAF-updated delayProgress — no CSS transitions.
 */
'use client';

interface DelayBarProps {
  delayProgress: number | null;
}

export default function DelayBar({ delayProgress }: DelayBarProps) {
  if (delayProgress === null) return null;

  // Fade out during final 15% of delay
  const opacity = delayProgress > 0.85 ? (1 - delayProgress) / 0.15 : 1;

  return (
    <div
      className="flex justify-center"
      style={{ marginTop: '12px' }}
    >
      <div
        style={{
          width: '180px',
          height: '2px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '1px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
            transformOrigin: 'center',
            transform: `scaleX(${Math.max(0, 1 - delayProgress)})`,
            opacity,
          }}
        />
      </div>
    </div>
  );
}
