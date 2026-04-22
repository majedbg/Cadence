/**
 * @file HeroDemo.tsx
 * @description Looping, self-contained preview of the Cadence session UI for
 *              the landing hero. Mimics the session page layout in miniature:
 *              a mock camera frame with the RSVP word docked beneath it, a
 *              script panel that highlights the "read" word in white as the
 *              loop advances, and a live WPM readout. No microphone, no
 *              network — purely a visual demonstration driven by a single
 *              requestAnimationFrame loop.
 *
 * COGNITIVE DEBT NOTICE:
 *   - Uses tokenise() from textUtils so the punctuation/delay behaviour
 *     matches the real engine, but intentionally omits drift, off-script,
 *     and Deepgram-sync code paths. The purpose here is to sell the feel
 *     of the product, not to faithfully simulate every edge case.
 *   - displayIndex and delayRemaining live in refs; React state is only
 *     flushed every 100ms (same cadence as the real engine) to keep the
 *     hero cheap on lower-powered laptops previewing the page.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { tokenise, computeDelayMs } from "@/lib/textUtils";
import { PUNCTUATION_DELAYS } from "@/lib/constants";
import HeroHeadline from "@/components/HeroHeadline";

const DEMO_SCRIPT =
  "Cadence is a browser teleprompter that flashes one word at a time at a fixed point near your camera, keeping your gaze locked on the lens. It listens as you speak and stays in sync with your natural pace, so the delivery never feels read.";

const DEMO_WPM = 165;
const LOOP_PAUSE_MS = 1800;
const FLUSH_INTERVAL_MS = 100;

export default function HeroDemo() {
  const tokens = useRef(tokenise(DEMO_SCRIPT)).current;

  const [displayIndex, setDisplayIndex] = useState(0);
  const [delayProgress, setDelayProgress] = useState<number | null>(null);

  const displayIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const delayRemainingRef = useRef(0);
  const delayTotalRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const pausedUntilRef = useRef<number>(0);

  useEffect(() => {
    let rafId = 0;
    const msPerWord = 60_000 / DEMO_WPM;

    const frame = (now: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = now;
      const delta = Math.min(now - lastFrameRef.current, msPerWord * 2);
      lastFrameRef.current = now;

      if (now < pausedUntilRef.current) {
        rafId = requestAnimationFrame(frame);
        return;
      }

      if (delayRemainingRef.current > 0) {
        delayRemainingRef.current = Math.max(
          0,
          delayRemainingRef.current - delta
        );
        rafId = requestAnimationFrame(frame);
        return;
      }

      accumulatorRef.current += delta;
      if (accumulatorRef.current >= msPerWord) {
        accumulatorRef.current -= msPerWord;

        const prevToken = tokens[displayIndexRef.current];
        const nextIndex = displayIndexRef.current + 1;

        if (nextIndex >= tokens.length) {
          pausedUntilRef.current = now + LOOP_PAUSE_MS;
          accumulatorRef.current = 0;
          delayRemainingRef.current = 0;
          delayTotalRef.current = 0;
          setTimeout(() => {
            displayIndexRef.current = 0;
          }, LOOP_PAUSE_MS - 40);
        } else {
          displayIndexRef.current = nextIndex;
          if (prevToken) {
            const d = computeDelayMs(prevToken, PUNCTUATION_DELAYS);
            if (d > 0) {
              delayRemainingRef.current = d;
              delayTotalRef.current = d;
            }
          }
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    const flush = window.setInterval(() => {
      setDisplayIndex(displayIndexRef.current);
      if (delayTotalRef.current > 0 && delayRemainingRef.current > 0) {
        setDelayProgress(1 - delayRemainingRef.current / delayTotalRef.current);
      } else {
        setDelayProgress(null);
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(flush);
    };
  }, [tokens]);

  const currentToken = tokens[displayIndex];
  const nextToken = tokens[displayIndex + 1];

  return (
    <div
      className="relative w-full max-w-3xl mx-auto overflow-hidden"
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
        boxShadow:
          "0 40px 120px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02) inset",
      }}
    >
      {/* Embedded headline — the same lockup that appears on the landing
          hero, shown at reduced size so the demo card reads as a titled
          preview rather than a naked screenshot. */}

      {/* Chrome strip — mimics the session screen's top-bar vocabulary */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-[10px] uppercase tabular-nums"
        style={{
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(255,255,255,0.015)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: "#88CC4D",
              boxShadow: "0 0 6px rgba(136,204,77,0.7)",
            }}
          />
          Preview (pretend this is a laptop screen)
        </div>
        {/* Lens-aim marker at top-center — suggests "speak into here" */}
        <div
          style={{
            position: "absolute",
            top: 15,
            left: "50%",
            transform: "translateX(-50%)",
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: "rgba(229,134,58,0.8)",
            boxShadow: "0 0 6px rgba(255,255,255,0.35)",
          }}
        />
        <div className="flex items-center gap-3">
          <span>{DEMO_WPM} WPM</span>
          <span
            className="inline-block w-px h-3"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          />
        </div>
      </div>

      {/* Camera + RSVP zone */}
      <div className="flex flex-col items-center pt-2 pb-5 px-6">
        {/* RSVP word directly below the camera — mirrors the real session's
            "word near the lens" promise. */}
        <div className="flex flex-col items-center mt-2 min-h-[96px]">
          <span
            key={`w-${displayIndex}`}
            style={{
              fontSize: "clamp(2rem, 5vw, 3.25rem)",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#ffffff",
              lineHeight: 1,
              animation: "hero-rsvp-in 160ms ease-out",
            }}
          >
            {currentToken?.original ?? ""}
          </span>
          {nextToken && (
            <span
              style={{
                fontSize: "clamp(1rem, 2.4vw, 1.5rem)",
                fontWeight: 400,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              {nextToken.original}
            </span>
          )}
          <div
            className="mt-2"
            style={{
              width: 64,
              height: 2,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            {delayProgress !== null && (
              <div
                style={{
                  height: "100%",
                  width: `${delayProgress * 100}%`,
                  backgroundColor: "rgba(229,134,58,0.8)",
                  transition: "width 80ms linear",
                }}
              />
            )}
          </div>
        </div>
        <MockCamera />
      </div>

      {/* Script panel — flowing text with the current word highlighted */}
      <div
        className="px-6 pb-5 pt-4"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          backgroundColor: "rgba(255,255,255,0.015)",
        }}
      >
        <p
          className="text-[10px] uppercase mb-3"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Original script
        </p>
        <p
          className="leading-relaxed text-left"
          style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {tokens.map((t, i) => {
            const isRead = i < displayIndex;
            const isCurrent = i === displayIndex;
            return (
              <span
                key={t.index}
                style={{
                  color:
                    isRead || isCurrent ? "#ffffff" : "rgba(255,255,255,0.35)",
                  opacity: isRead ? 1 : isCurrent ? 1 : 0.55,
                  backgroundColor: isCurrent
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                  borderRadius: 3,
                  padding: isCurrent ? "0 3px" : "0",
                  transition:
                    "color 180ms ease, background-color 180ms ease, opacity 180ms ease",
                }}
              >
                {t.original}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </p>
      </div>

      <style>{`
        @keyframes hero-rsvp-in {
          0% { opacity: 0.25; transform: translateY(-2px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        /* Pair of CSS-only blinking eyes rendered via two pseudo-elements.
           The white disc is the sclera, the inner radial-gradient dot is
           the pupil, and the top linear gradient animates its size from
           40% → 120% → 40% to simulate a blink (the "eyelid"). */
        .hero-demo-eyes {
          display: inline-flex;
          gap: 10px;
        }
        .hero-demo-eyes::before,
        .hero-demo-eyes::after {
          content: "";
          height: 20px;
          aspect-ratio: 1;
          border-radius: 50%;
          background:
            linear-gradient(#222 0 0) top / 100% 40% no-repeat,
            radial-gradient(farthest-side, #000 95%, transparent) 50% / 8px 8px no-repeat
            #fff;
          animation: hero-demo-blink 1.5s infinite alternate ease-in;
        }
        @keyframes hero-demo-blink {
          0%, 70% { background-size: 100% 40%, 8px 8px; }
          85%     { background-size: 100% 120%, 8px 8px; }
          100%    { background-size: 100% 40%, 8px 8px; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MockCamera — stylised stand-in for the real VideoPreview          */
/* ------------------------------------------------------------------ */

function MockCamera() {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        maxWidth: 420,
        aspectRatio: "16 / 9",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: "#050505",
        boxShadow: "0 24px 60px -24px rgba(0,0,0,0.8)",
      }}
    >
      {/* Soft studio gradient — implies a subject lit from above-left */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 45% 35%, rgba(229,134,58,0.10) 0%, rgba(20,18,16,0.9) 55%, #050505 100%)",
        }}
      />

      {/* Silhouette — head + shoulders */}
      <svg
        viewBox="0 0 200 112"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="silhouette" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="58" r="20" fill="url(#silhouette)" />
        <path
          d="M 52 112 C 52 92 72 82 100 82 C 128 82 148 92 148 112 Z"
          fill="url(#silhouette)"
        />
      </svg>

      {/* Recording badge */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 8px 3px 6px",
          borderRadius: 999,
          backgroundColor: "rgba(10,10,10,0.65)",
          backdropFilter: "blur(6px)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            backgroundColor: "#BF3A27",
            animation: "hero-rec-pulse 1.4s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.85)",
            textTransform: "uppercase",
          }}
        >
          Rec
        </span>
      </div>

      <style>{`
        @keyframes hero-rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
