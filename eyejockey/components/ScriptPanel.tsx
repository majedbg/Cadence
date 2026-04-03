/**
 * @file ScriptPanel.tsx
 * @description Displays the original script as flowing text with the current
 *              word highlighted. Past words dim, future words are semi-bright.
 *              Auto-scrolls to keep the current word centered in view.
 */
'use client';

import { useEffect, useRef } from 'react';
import type { WordToken } from '@/lib/types';

interface ScriptPanelProps {
  tokens: WordToken[];
  currentIndex: number;
}

export default function ScriptPanel({ tokens, currentIndex }: ScriptPanelProps) {
  const currentWordRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (currentWordRef.current) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentIndex]);

  return (
    <div
      className="flex flex-col h-full overflow-y-auto rounded-xl p-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        Original Script
      </p>
      <div className="leading-relaxed text-base flex flex-wrap gap-x-1.5 gap-y-1">
        {tokens.map((token) => {
          const isCurrent = token.index === currentIndex;
          const isPast = token.index < currentIndex;

          let opacity: number;
          if (isCurrent) opacity = 1;
          else if (isPast) opacity = 0.3;
          else opacity = 0.6;

          return (
            <span
              key={token.index}
              ref={isCurrent ? currentWordRef : undefined}
              className="inline-block rounded px-1"
              style={{
                opacity,
                color: '#ffffff',
                backgroundColor: isCurrent
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                transition: 'opacity 150ms ease, background-color 150ms ease',
              }}
            >
              {token.original}
            </span>
          );
        })}
      </div>
    </div>
  );
}
