/**
 * @file page.tsx (calibrate)
 * @description Screen 2 — WPM Calibration. The user reads a fixed passage
 *              aloud for 10 seconds. Deepgram transcribes it, and the app
 *              calculates their natural words-per-minute reading pace.
 *
 * COGNITIVE DEBT NOTICE:
 *   - MediaRecorder stops at 10s, Deepgram drains for 1.5s extra.
 *   - WPM calculated from actual Deepgram word timestamps.
 *   - Passage fades out after recording; transcript + result scroll up.
 *   - On retry: 3-2-1 lead-in countdown, then recording starts.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDeepgram } from '@/hooks/useDeepgram';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useLeadIn } from '@/hooks/useLeadIn';
import { classifyWPM } from '@/lib/textUtils';
import {
  CALIBRATION_PASSAGE,
  CALIBRATION_DURATION_MS,
  STORAGE_KEY_WPM,
} from '@/lib/constants';
import WPMResultCard from '@/components/WPMResultCard';
import ConnectionStatus from '@/components/ConnectionStatus';
import LeadInOverlay from '@/components/LeadInOverlay';

const DEEPGRAM_DRAIN_MS = 1500;

type Phase = 'idle' | 'lead-in' | 'recording' | 'processing' | 'done';

export default function CalibratePage() {
  const router = useRouter();
  const {
    finalWords,
    interimTranscript,
    connectionState,
    error,
    start: startDeepgram,
    stop: stopDeepgram,
  } = useDeepgram();
  const { isRecording, stream, startRecording, stopRecording } = useMediaRecorder();
  const { countdownValue, startLeadIn } = useLeadIn();

  const [calibratedWPM, setCalibratedWPM] = useState<number | null>(null);
  const [calibratedWordCount, setCalibratedWordCount] = useState(0);
  const [calibratedDuration, setCalibratedDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start the actual recording (called after lead-in completes or directly)
  const beginRecording = useCallback(async () => {
    setPhase('recording');
    setCountdown(Math.round(CALIBRATION_DURATION_MS / 1000));
    await startRecording();
  }, [startRecording]);

  // Initial record button click — start immediately (no lead-in first time)
  const handleRecord = useCallback(async () => {
    setCalibratedWPM(null);
    setCalibratedWordCount(0);
    await beginRecording();
  }, [beginRecording]);

  // Retry — show 3-2-1 lead-in, then start recording
  const handleRetry = useCallback(() => {
    setCalibratedWPM(null);
    setCalibratedWordCount(0);
    setCalibratedDuration(0);
    setPhase('lead-in');
    startLeadIn(async () => {
      await beginRecording();
    });
  }, [startLeadIn, beginRecording]);

  // When stream becomes available after startRecording, begin Deepgram
  useEffect(() => {
    if (isRecording && stream && stream !== streamRef.current) {
      streamRef.current = stream;
      startDeepgram(stream);

      // Start countdown interval
      const startTime = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((CALIBRATION_DURATION_MS - elapsed) / 1000));
        setCountdown(remaining);
        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 250);

      // After calibration duration: stop recording, drain Deepgram
      timerRef.current = setTimeout(() => {
        stopRecording();
        setPhase('processing');
        setCountdown(null);

        setTimeout(() => {
          stopDeepgram();
          setPhase('done');
        }, DEEPGRAM_DRAIN_MS);
      }, CALIBRATION_DURATION_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isRecording, stream, startDeepgram, stopDeepgram, stopRecording]);

  // Calculate WPM when calibration finishes and we have words.
  // Count ALL recognized words (final + interim) since Deepgram's smart_format
  // holds many words as interim and never promotes them to is_final before close.
  useEffect(() => {
    if (phase === 'done' && calibratedWPM === null) {
      // Count final words + any remaining interim words
      const interimWords = interimTranscript.trim()
        ? interimTranscript.trim().split(/\s+/).length
        : 0;
      const totalWords = finalWords.length + interimWords;

      if (totalWords === 0) return;

      const calibrationSec = CALIBRATION_DURATION_MS / 1000;
      const wpm = (totalWords / calibrationSec) * 60;

      setCalibratedWPM(wpm);
      setCalibratedWordCount(totalWords);
      setCalibratedDuration(calibrationSec);
      sessionStorage.setItem(STORAGE_KEY_WPM, String(Math.round(wpm)));
    }
  }, [phase, finalWords, interimTranscript, calibratedWPM]);

  const handleNext = () => router.push('/session');
  const handleSkip = () => router.push('/session');

  const wpmRange = calibratedWPM !== null ? classifyWPM(calibratedWPM) : null;

  const liveTranscript =
    finalWords.map((w) => w.word).join(' ') +
    (interimTranscript ? ' ' + interimTranscript : '');

  // Passage visibility: hidden after recording is done (fades out)
  const passageVisible = phase === 'idle' || phase === 'lead-in' || phase === 'recording';
  const isActivelyReading = phase === 'recording';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
    >
      {/* Lead-in overlay for retry */}
      <LeadInOverlay countdownValue={phase === 'lead-in' ? countdownValue : null} />

      {/* Connection status indicator — top left */}
      <div className="fixed top-4 left-6 z-40">
        <ConnectionStatus state={connectionState} />
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center">
        First things first — what is your reading pace?
      </h1>
      <p
        className="text-lg mb-8 text-center"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Hit Record when ready, grant microphone access, and read the passage below.
      </p>

      {/* Calibration passage — fades out after recording completes */}
      <div
        className="max-w-2xl w-full rounded-xl p-6 leading-relaxed text-lg"
        style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          color: isActivelyReading
            ? 'rgba(255,255,255,1)'
            : 'rgba(255,255,255,0.5)',
          border: isActivelyReading
            ? '1px solid rgba(59,130,246,0.4)'
            : '1px solid transparent',
          boxShadow: isActivelyReading
            ? '0 0 20px rgba(59,130,246,0.15), 0 0 40px rgba(59,130,246,0.05)'
            : 'none',
          opacity: passageVisible ? 1 : 0,
          maxHeight: passageVisible ? '600px' : '0px',
          overflow: 'hidden',
          marginBottom: passageVisible ? '16px' : '0px',
          padding: passageVisible ? '24px' : '0px 24px',
          transition: 'all 500ms ease',
        }}
      >
        {CALIBRATION_PASSAGE}
      </div>

      {/* Countdown — large, beneath the passage during recording */}
      <div
        style={{
          opacity: countdown !== null ? 1 : 0,
          maxHeight: countdown !== null ? '120px' : '0px',
          overflow: 'hidden',
          marginBottom: countdown !== null ? '16px' : '0px',
          transition: 'all 400ms ease',
        }}
      >
        <div className="flex flex-col items-center">
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: '48px', color: '#60A5FA' }}
          >
            {countdown ?? ''}
          </span>
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: 'rgba(96,165,250,0.4)' }}
          >
            seconds remaining
          </span>
        </div>
      </div>

      {/* Lead-in countdown display (for retry — shows where the 10s timer will be) */}
      {phase === 'lead-in' && countdownValue !== null && (
        <div className="flex flex-col items-center mb-4">
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: '48px', color: 'rgba(255,255,255,0.3)' }}
          >
            {Math.round(CALIBRATION_DURATION_MS / 1000)}
          </span>
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.15)' }}
          >
            seconds remaining
          </span>
        </div>
      )}

      {/* Live transcript — scrolls up to replace the passage */}
      <div
        style={{
          opacity: liveTranscript.trim().length > 0 ? 1 : 0,
          maxHeight: liveTranscript.trim().length > 0 ? '400px' : '0px',
          overflow: 'hidden',
          transition: 'all 500ms ease',
        }}
        className="max-w-2xl w-full"
      >
        <div
          className="rounded-xl p-4 mb-6 text-sm leading-relaxed"
          style={{
            backgroundColor: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
            color: '#60A5FA',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: 'rgba(96,165,250,0.4)' }}
            >
              What we heard
            </p>
            {phase === 'processing' && (
              <span className="text-xs" style={{ color: 'rgba(96,165,250,0.5)' }}>
                Finalizing…
              </span>
            )}
          </div>
          {liveTranscript}
        </div>
      </div>

      {error && (
        <p className="text-red-400 mb-4 text-sm">{error}</p>
      )}

      {/* Action buttons */}
      {phase === 'idle' && (
        <button
          onClick={handleRecord}
          className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
          style={{ backgroundColor: '#EF4444', color: '#ffffff' }}
        >
          Record
        </button>
      )}

      {(phase === 'recording' || phase === 'processing') && (
        <button
          disabled
          className="px-8 py-3 rounded-full font-semibold text-lg opacity-50"
          style={{ backgroundColor: '#374151', color: '#ffffff' }}
        >
          {phase === 'recording'
            ? `Recording… (${countdown ?? 0}s)`
            : 'Processing…'}
        </button>
      )}

      {phase === 'done' && calibratedWPM !== null && (
        <div className="w-full max-w-md">
          <WPMResultCard
            wpm={calibratedWPM}
            range={wpmRange!}
            wordCount={calibratedWordCount}
            durationSeconds={calibratedDuration}
          />
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <button
          onClick={handleSkip}
          className="px-6 py-2 rounded-full text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Skip
        </button>

        {phase === 'done' && wpmRange !== null && wpmRange !== 'good' && (
          <button
            onClick={handleRetry}
            className="px-6 py-2 rounded-full font-semibold text-sm transition-colors"
            style={{
              color: '#60A5FA',
              border: '1px solid rgba(59,130,246,0.4)',
            }}
          >
            Try Again
          </button>
        )}

        <button
          onClick={handleNext}
          className="px-6 py-2 rounded-full font-semibold text-sm transition-colors"
          style={{ backgroundColor: '#ffffff', color: '#0a0a0a' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
