/**
 * @file LeadInOverlay.tsx
 * @description Countdown overlay (3, 2, 1) before recording starts.
 *              Positioned below the RSVP word area so the first word remains
 *              visible during the countdown — users can see what they'll read.
 */
'use client';

interface LeadInOverlayProps {
  countdownValue: number | null;
}

export default function LeadInOverlay({ countdownValue }: LeadInOverlayProps) {
  if (countdownValue === null) return null;

  return (
    <div
      className="fixed left-0 right-0 flex items-center justify-center z-[100] pointer-events-none"
      style={{ top: '30vh' }}
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
        style={{
          fontSize: '96px',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.3)',
          animation: 'countdownPulse 900ms ease-in-out forwards',
        }}
      >
        {countdownValue}
      </span>
    </div>
  );
}
