/**
 * @file TakeCard.tsx
 * @description Expandable card for a completed recording take. Shows take number,
 *              and expands to reveal transcript text, audio player, and download button.
 */
"use client";

import { useState, useCallback } from "react";
import type { TranscriptEntry } from "@/lib/types";

interface TakeCardProps {
  takeNumber: number;
  transcript: TranscriptEntry[];
  audioURL: string;
  /** Whether this card starts expanded (latest take auto-expands) */
  defaultExpanded?: boolean;
}

export default function TakeCard({
  takeNumber,
  transcript,
  audioURL,
  defaultExpanded = false,
}: TakeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = audioURL;
    a.download = `take-${takeNumber}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioURL, takeNumber]);

  const wordCount = transcript.length;
  const offScriptCount = transcript.filter((t) => t.isOffScript).length;

  return (
    <div
      className="rounded-xl overflow-hidden max-w-md mx-auto"
      style={{
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header — always visible, clickable to toggle */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ color: "#ffffff" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center rounded-md text-xs font-bold"
            style={{
              width: "28px",
              height: "28px",
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {takeNumber}
          </span>
          <span className="text-sm font-semibold">Take {takeNumber}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {wordCount} words
          </span>
          {offScriptCount > 0 && (
            <span className="text-xs" style={{ color: "#A855F7" }}>
              · {offScriptCount} off-script
            </span>
          )}
        </div>
        <span
          className="text-sm transition-transform"
          style={{
            color: "rgba(255,255,255,0.3)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {/* Expandable body */}
      <div
        style={{
          maxHeight: expanded ? "1000px" : "0px",
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 400ms ease, opacity 200ms ease",
        }}
      >
        <div className="px-4 pb-4">
          {/* Transcript text — paragraph format, scrollable */}
          <div
            className="rounded-lg p-3 mb-3 text-sm leading-relaxed overflow-y-auto"
            style={{
              backgroundColor: "rgba(255,255,255,0.02)",
              maxHeight: "240px",
            }}
          >
            <p className="whitespace-pre-wrap">
              {transcript.map((entry, i) => (
                <span
                  key={`${entry.timestamp}-${i}`}
                  style={{
                    color: entry.isOffScript
                      ? "#A855F7"
                      : "rgba(255,255,255,0.7)",
                    fontWeight: entry.isOffScript ? 600 : 400,
                  }}
                >
                  {entry.word}{" "}
                </span>
              ))}
            </p>
            {transcript.length === 0 && (
              <span style={{ color: "rgba(255,255,255,0.2)" }}>
                No transcript
              </span>
            )}
          </div>

          {/* Audio player */}
          <audio controls src={audioURL} className="w-full mb-3" />

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download take-{takeNumber}.webm
          </button>
        </div>
      </div>
    </div>
  );
}
