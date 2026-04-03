/**
 * @file LeadInOverlay.tsx
 * @description Full-screen countdown overlay (3, 2, 1) before recording starts.
 *              Uses CSS keyframe animation for fade in/out per digit.
 *              Returns null when countdownValue is null.
 */
'use client';

interface LeadInOverlayProps {
  countdownValue: number | null;
}

export default function LeadInOverlay({ countdownValue }: LeadInOverlayProps) {
  if (countdownValue === null) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
    >
      <style>{`
        @keyframes countdownPulse {
          0% { opacity: 0; transform: scale(0.8); }
          20% { opacity: 1; transform: scale(1); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.1); }
        }
      `}</style>
      <span
        key={countdownValue}
        className="text-white"
        style={{
          fontSize: '128px',
          fontWeight: 700,
          animation: 'countdownPulse 900ms ease-in-out forwards',
        }}
      >
        {countdownValue}
      </span>
    </div>
  );
}
