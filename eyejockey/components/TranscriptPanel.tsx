/**
 * @file TranscriptPanel.tsx
 * @description Live transcript display. Each word is rendered inline; off-script
 *              words appear in purple with slightly bolder weight. Auto-scrolls
 *              to the bottom as new entries arrive.
 */
'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '@/lib/types';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
}

export default function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript.length]);

  return (
    <div
      className="flex flex-col h-full overflow-y-auto rounded-xl p-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        Live transcript
      </p>
      <div className="leading-relaxed text-base flex flex-wrap gap-x-1.5 gap-y-1">
        {transcript.map((entry, i) => (
          <span
            key={`${entry.timestamp}-${i}`}
            className="inline-block"
            style={{
              color: entry.isOffScript ? '#A855F7' : '#ffffff',
              fontWeight: entry.isOffScript ? 600 : 400,
            }}
          >
            {entry.word}
          </span>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
