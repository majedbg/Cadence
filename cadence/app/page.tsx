/**
 * @file page.tsx (home / landing hero)
 * @description Screen 0 — Landing. A minimal hero that introduces Cadence
 *              in two sentences and hands off to the script-input screen via
 *              a single "Try" CTA. Kept intentionally quiet so the product
 *              voice (warm-dark, VU-amber accent) sets the tone before any
 *              chrome appears.
 */
'use client';

import { useRouter } from 'next/navigation';
import Wordmark from '@/components/Wordmark';
import HeroDemo from '@/components/HeroDemo';

export default function Landing() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col px-6 py-8"
      style={{ backgroundColor: '#0d0f0c', color: '#ffffff' }}
    >
      <div className="z-40">
        <Wordmark tone="bold" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs uppercase tracking-[0.18em] mb-8"
          style={{
            color: 'rgba(229,134,58,0.9)',
            border: '1px solid rgba(229,134,58,0.25)',
            backgroundColor: 'rgba(229,134,58,0.06)',
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(229,134,58,0.9)' }}
          />
          RSVP Teleprompter
        </div>

        <h1
          className="font-semibold tracking-tight mb-6"
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}
        >
          Words on cue.
          <br />
          <span style={{ color: 'rgba(229,134,58,0.95)' }}>
            Eyes on lens.
          </span>
        </h1>

        <div className="w-full mb-10">
          <HeroDemo />
        </div>

        <button
          onClick={() => router.push('/script')}
          className="group inline-flex items-center gap-3 px-7 py-3 rounded-full font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.99]"
          style={{
            backgroundColor: '#ffffff',
            color: '#0d0f0c',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.1), 0 12px 40px -12px rgba(229,134,58,0.35)',
          }}
        >
          Try it
          <span
            aria-hidden="true"
            className="inline-block transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </button>

        <p
          className="text-xs mt-6"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Works best in Chrome · microphone access required
        </p>
      </main>
    </div>
  );
}
