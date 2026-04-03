/**
 * @file RecordingCard.tsx
 * @description Post-recording card showing the merged script (with off-script
 *              markers rendered in purple), an audio playback element, and a
 *              button to copy the cleaned script to the clipboard.
 */
'use client';

import { useCallback, useState } from 'react';

interface RecordingCardProps {
  audioURL: string;
  mergedScript: string;
}

interface ParsedSegment {
  text: string;
  isOffScript: boolean;
}

/**
 * Parses a merged script string, splitting it into segments of normal text
 * and off-script markers like [[OFF:word]].
 */
function parseMergedScript(script: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /\[\[OFF:(.*?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(script)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: script.slice(lastIndex, match.index),
        isOffScript: false,
      });
    }
    segments.push({
      text: match[1],
      isOffScript: true,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < script.length) {
    segments.push({
      text: script.slice(lastIndex),
      isOffScript: false,
    });
  }

  return segments;
}

/**
 * Strips [[OFF:...]] markers, keeping just the inner word.
 */
function stripMarkers(script: string): string {
  return script.replace(/\[\[OFF:(.*?)\]\]/g, '$1');
}

export default function RecordingCard({ audioURL, mergedScript }: RecordingCardProps) {
  const [copied, setCopied] = useState(false);
  const segments = parseMergedScript(mergedScript);

  const handleCopy = useCallback(async () => {
    const plain = stripMarkers(mergedScript);
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [mergedScript]);

  return (
    <div
      className="mx-auto max-w-2xl rounded-xl p-6 mt-6"
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <p
        className="text-xs uppercase tracking-widest mb-4"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        Recording
      </p>

      {/* Merged script with off-script highlights */}
      <div
        className="text-base leading-relaxed mb-6"
        style={{ color: '#ffffff' }}
      >
        {segments.map((seg, i) =>
          seg.isOffScript ? (
            <span
              key={i}
              style={{ color: '#A855F7', fontWeight: 600 }}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>

      {/* Audio playback */}
      <audio
        controls
        src={audioURL}
        className="w-full mb-4"
      />

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: copied ? '#22C55E' : 'rgba(255,255,255,0.08)',
          color: '#ffffff',
        }}
      >
        {copied ? 'Copied!' : 'Copy updated script'}
      </button>
    </div>
  );
}
