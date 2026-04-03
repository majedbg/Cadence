/**
 * @file SettingsPopper.tsx
 * @description Gear icon button + popover with per-punctuation delay sliders.
 *              Toggle open/closed; dark glass-morphism popover styling.
 */
'use client';

import { useState } from 'react';
import type { DelaySettings } from '@/lib/types';
import {
  MIN_PUNCTUATION_DELAY,
  MAX_PUNCTUATION_DELAY,
} from '@/lib/constants';

const PUNCT_LABELS: Record<string, string> = {
  ',': 'comma',
  '.': 'period',
  ';': 'semicolon',
  ':': 'colon',
  '\u2014': 'em dash',
  '\u2013': 'en dash',
  '\u2026': 'ellipsis',
  '?': 'question',
  '!': 'exclamation',
  '\u00B6': 'paragraph',
};

interface SettingsPopperProps {
  delays: DelaySettings;
  onSetDelay: (punct: string, ms: number) => void;
  onReset: () => void;
}

export default function SettingsPopper({ delays, onSetDelay, onReset }: SettingsPopperProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* Gear trigger */}
      <button
        type="button"
        aria-label="Punctuation delay settings"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          lineHeight: 1,
          color: open ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
          fontSize: '20px',
          transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)';
          }
        }}
      >
        ⚙
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '280px',
            padding: '16px',
            backgroundColor: 'rgba(15,15,15,0.95)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            backdropFilter: 'blur(8px)',
            zIndex: 40,
          }}
        >
          {/* Title */}
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Punctuation delays
          </p>

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(PUNCT_LABELS).map(([punct, label]) => {
              const value = delays[punct] ?? 0;
              return (
                <div key={punct} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Punctuation symbol */}
                  <span
                    style={{
                      width: '20px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.6)',
                      flexShrink: 0,
                    }}
                  >
                    {punct}
                  </span>

                  {/* Label */}
                  <span
                    style={{
                      width: '68px',
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>

                  {/* Slider */}
                  <input
                    type="range"
                    min={MIN_PUNCTUATION_DELAY}
                    max={MAX_PUNCTUATION_DELAY}
                    step={10}
                    value={value}
                    onChange={(e) => onSetDelay(punct, Number(e.target.value))}
                    aria-label={`${label} delay`}
                    style={{ flex: 1, accentColor: '#ffffff' }}
                  />

                  {/* Value */}
                  <span
                    style={{
                      width: '42px',
                      textAlign: 'right',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {value}ms
                  </span>
                </div>
              );
            })}
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={onReset}
            style={{
              marginTop: '14px',
              width: '100%',
              padding: '6px 0',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.4)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'rgba(255,255,255,0.06)';
            }}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
