/**
 * @file ScriptPanel.tsx
 * @description Displays the original script as flowing text with per-word state
 *              coloring. Past confirmed words are bright, unconfirmed words are
 *              amber, and future planned words are dim. The current display
 *              position gets a highlight background and auto-scrolls into view.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import type { WordState } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Memoised per-word span                                            */
/* ------------------------------------------------------------------ */

interface WordSpanProps {
  wordState: WordState;
  isCurrent: boolean;
}

const WordSpan = React.memo(
  function WordSpan({ wordState, isCurrent }: WordSpanProps) {
    const { status, token } = wordState;

    let color: string;
    let opacity: number;
    let backgroundColor: string;

    switch (status) {
      case 'confirmed':
        color = '#ffffff';
        opacity = 1;
        backgroundColor = 'transparent';
        break;
      case 'displayed':
        color = '#ffffff';
        opacity = 1;
        backgroundColor = 'rgba(255,255,255,0.08)';
        break;
      case 'unconfirmed':
        color = '#F59E0B';
        opacity = 0.5;
        backgroundColor = 'transparent';
        break;
      case 'planned':
      default:
        color = '#ffffff';
        opacity = 0.4;
        backgroundColor = 'transparent';
        break;
    }

    // The word at displayIndex gets the special "current" highlight
    if (isCurrent) {
      backgroundColor = 'rgba(255,255,255,0.08)';
    }

    return (
      <span
        className="inline-block rounded px-1"
        data-current={isCurrent || undefined}
        style={{
          opacity,
          color,
          backgroundColor,
          transition: 'opacity 150ms ease, background-color 150ms ease',
        }}
      >
        {token.original}
      </span>
    );
  },
  (prev, next) =>
    prev.wordState.status === next.wordState.status &&
    prev.isCurrent === next.isCurrent,
);

/* ------------------------------------------------------------------ */
/*  ScriptPanel                                                       */
/* ------------------------------------------------------------------ */

interface ScriptPanelProps {
  wordStates: WordState[];
  displayIndex: number;
}

export default function ScriptPanel({ wordStates, displayIndex }: ScriptPanelProps) {
  const currentWordRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (currentWordRef.current) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [displayIndex]);

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
        {wordStates.map((ws) => {
          const isCurrent = ws.token.index === displayIndex;
          return (
            <span key={ws.token.index} ref={isCurrent ? currentWordRef : undefined}>
              <WordSpan wordState={ws} isCurrent={isCurrent} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
