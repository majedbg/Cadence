/**
 * @file VideoPreview.tsx
 * @description Live camera preview that docks to the right of the RSVP zone.
 *              Maximised before a take begins so the user can frame their
 *              shot; minimises to a small pip once RSVP starts so it stays
 *              in peripheral view without pulling focus from the script.
 *              Mirrored horizontally (selfie mode) on display only — the
 *              recorded stream itself is never flipped.
 */
'use client';

import { useEffect, useRef } from 'react';

interface VideoPreviewProps {
  stream: MediaStream | null;
  minimized: boolean;
  /** When true, the RSVP zone above has grown taller (off-script runway),
   *  so the preview nudges down to avoid crowding. */
  yieldToRsvp?: boolean;
}

export default function VideoPreview({
  stream,
  minimized,
  yieldToRsvp = false,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      if (stream) {
        // Some browsers require an explicit play() after srcObject swap.
        el.play().catch(() => {});
      }
    }
  }, [stream]);

  if (!stream) return null;

  const topPx = minimized ? 72 : yieldToRsvp ? 104 : 84;
  const rightPx = minimized ? 24 : 40;
  const width = minimized ? 168 : 'min(32vw, 440px)';

  return (
    <div
      className="fixed z-20 overflow-hidden"
      style={{
        top: `${topPx}px`,
        right: `${rightPx}px`,
        width,
        aspectRatio: '16 / 9',
        borderRadius: minimized ? 10 : 14,
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: '#050505',
        boxShadow: minimized
          ? '0 6px 24px rgba(0,0,0,0.45)'
          : '0 24px 72px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
        transition:
          'top 520ms cubic-bezier(0.22, 1, 0.36, 1), right 520ms cubic-bezier(0.22, 1, 0.36, 1), width 520ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 520ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 520ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          display: 'block',
        }}
      />
      {/* Subtle recording dot — only visible when minimized (during a take). */}
      {minimized && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px 3px 6px',
            borderRadius: 999,
            backgroundColor: 'rgba(10,10,10,0.65)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: '#EF4444',
              animation: 'rec-dot-pulse 1.4s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.85)',
              textTransform: 'uppercase',
            }}
          >
            Rec
          </span>
        </div>
      )}
      <style>{`
        @keyframes rec-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
