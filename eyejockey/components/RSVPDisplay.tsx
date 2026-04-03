/**
 * @file RSVPDisplay.tsx
 * @description Central RSVP word display. Shows the current teleprompter word
 *              near the webcam position (top: 18vh). Handles synced, offscript,
 *              waiting, and done states with appropriate visual transitions.
 */
'use client';

import type { RSVPStatus } from '@/lib/types';

interface RSVPDisplayProps {
  word: string;
  runway: string[];
  status: RSVPStatus;
}

export default function RSVPDisplay({ word, runway, status }: RSVPDisplayProps) {
  if (status === 'waiting') {
    return (
      <div
        className="fixed left-0 right-0 flex items-center justify-center"
        /* 18vh — magic number: positions text near typical laptop webcam height */
        style={{ top: '18vh' }}
      >
        <span
          className="text-center"
          style={{
            fontSize: '36px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          Waiting for speech…
        </span>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div
        className="fixed left-0 right-0 flex items-center justify-center"
        style={{ top: '18vh' }}
      >
        <span
          className="text-center"
          style={{
            fontSize: '64px',
            fontWeight: 600,
            color: '#22C55E',
          }}
        >
          Done!
        </span>
      </div>
    );
  }

  const isOffScript = status === 'offscript';

  return (
    <div
      className="fixed left-0 right-0 flex flex-col items-center justify-center"
      /* 18vh — magic number: positions text near typical laptop webcam height */
      style={{ top: '18vh' }}
    >
      {/* Runway words shown above during off-script */}
      {isOffScript && runway.length > 0 && (
        <div
          className="flex gap-3 mb-4"
          style={{
            transform: 'translateY(-8px)',
          }}
        >
          {runway.map((rw, i) => (
            <span
              key={`${rw}-${i}`}
              style={{
                fontSize: '36px',
                fontWeight: 400,
                opacity: 0.4,
                color: '#F59E0B',
              }}
            >
              {rw}
            </span>
          ))}
        </div>
      )}

      {/* Main RSVP word */}
      <span
        style={{
          fontSize: '64px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: isOffScript ? '#F59E0B' : '#ffffff',
          opacity: isOffScript ? 0.2 : 1,
          transition: 'opacity 200ms ease',
        }}
      >
        {word}
      </span>
    </div>
  );
}
