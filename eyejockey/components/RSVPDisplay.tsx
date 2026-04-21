/**
 * @file RSVPDisplay.tsx
 * @description Central RSVP word display near the top of the screen.
 *              Shows current word + next word preview beneath (reducing saccades).
 *              Handles synced, offscript, waiting, done, and drifting states.
 */
'use client';

import type { RSVPStatus } from '@/lib/types';
import DelayBar from '@/components/DelayBar';

interface RSVPDisplayProps {
  word: string;
  nextWord: string;
  runway: string[];
  status: RSVPStatus;
  delayProgress: number | null;
  isDrifting: boolean;
}

export default function RSVPDisplay({
  word,
  nextWord,
  runway,
  status,
  delayProgress,
  isDrifting,
}: RSVPDisplayProps) {
  if (status === 'waiting') {
    return (
      <div
        className="fixed left-0 right-0 flex flex-col items-center justify-center"
        style={{ top: '20px' }}
      >
        <span
          className="text-center"
          style={{
            fontSize: '64px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          {word || 'Ready'}
        </span>
        {nextWord && (
          <span
            className="text-center"
            style={{
              fontSize: '36px',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.15)',
              marginTop: '4px',
            }}
          >
            {nextWord}
          </span>
        )}
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div
        className="fixed left-0 right-0 flex items-center justify-center"
        style={{ top: '20px' }}
      >
        <span
          className="text-center"
          style={{ fontSize: '64px', fontWeight: 600, color: '#22C55E' }}
        >
          Done!
        </span>
      </div>
    );
  }

  const isOffScript = status === 'offscript';
  const showDrifting = isDrifting && status === 'synced';

  return (
    <div
      className="fixed left-0 right-0 flex flex-col items-center justify-center"
      style={{ top: '20px' }}
    >
      {/* Main RSVP word — always rendered first so it's the top-most (and brightest) item. */}
      <span
        style={{
          fontSize: '64px',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: isOffScript ? '#F59E0B' : '#ffffff',
          opacity: isOffScript ? 0.85 : showDrifting ? 0.4 : 1,
          transition: 'opacity 200ms ease',
          animation: showDrifting ? 'rsvp-drift-pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        {word}
      </span>

      {/* Runway words shown during off-script (stacked vertically BELOW the main word,
          fading as they recede — matches the synced branch's current-then-next reading order). */}
      {isOffScript && runway.length > 0 && (
        <div
          className="flex flex-col items-center gap-0.5 mt-1"
        >
          {runway.map((rw, i) => (
            <span
              key={`${rw}-${i}`}
              style={{
                fontSize: `${Math.max(18, 30 - i * 3)}px`,
                fontWeight: 400,
                opacity: Math.max(0.15, 0.4 - i * 0.04),
                color: '#F59E0B',
              }}
            >
              {rw}
            </span>
          ))}
        </div>
      )}

      {/* Next word preview — tightly beneath main word, minimal eye movement */}
      {!isOffScript && nextWord && (
        <span
          style={{
            fontSize: '36px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.35)',
            marginTop: '-12px',
            transition: 'opacity 150ms ease',
            opacity: showDrifting ? 0.15 : 1,
          }}
        >
          {nextWord}
        </span>
      )}

      {/* Drifting / rewind label */}
      {showDrifting && (
        <span
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '8px',
            letterSpacing: '0.04em',
          }}
        >
          Rewinding…
        </span>
      )}

      <DelayBar delayProgress={delayProgress} />

      {showDrifting && (
        <style>{`
          @keyframes rsvp-drift-pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.6; }
          }
        `}</style>
      )}
    </div>
  );
}
