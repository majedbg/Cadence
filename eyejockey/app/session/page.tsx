/**
 * @file page.tsx (session)
 * @description Screen 3 — Teleprompter Session. Full viewport RSVP display
 *              with live Deepgram transcription, script tracking, speed meter,
 *              and recording playback. The core experience of EyeJockey.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDeepgram } from '@/hooks/useDeepgram';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useRSVP } from '@/hooks/useRSVP';
import { useLeadIn } from '@/hooks/useLeadIn';
import { mergedScript } from '@/lib/textUtils';
import {
  DEFAULT_SCRIPT,
  WPM_TARGET,
  STORAGE_KEY_SCRIPT,
  STORAGE_KEY_WPM,
} from '@/lib/constants';

import SpeedMeter from '@/components/SpeedMeter';
import RSVPDisplay from '@/components/RSVPDisplay';
import ScriptPanel from '@/components/ScriptPanel';
import TranscriptPanel from '@/components/TranscriptPanel';
import LeadInOverlay from '@/components/LeadInOverlay';

export default function SessionPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [targetWPM, setTargetWPM] = useState(WPM_TARGET);
  const [sessionDone, setSessionDone] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    const savedScript = sessionStorage.getItem(STORAGE_KEY_SCRIPT);
    if (savedScript) setScript(savedScript);

    const savedWPM = sessionStorage.getItem(STORAGE_KEY_WPM);
    if (savedWPM) {
      const parsed = parseInt(savedWPM, 10);
      if (!isNaN(parsed) && parsed > 0) setTargetWPM(parsed);
    }
  }, []);

  const {
    finalWords,
    isConnected,
    error: dgError,
    start: startDeepgram,
    stop: stopDeepgram,
  } = useDeepgram();

  const {
    isRecording,
    audioURL,
    stream,
    startRecording,
    stopRecording,
  } = useMediaRecorder();

  const {
    currentWord,
    currentIndex,
    runway,
    status,
    speedRatio,
    tokens,
    transcript,
  } = useRSVP({
    script,
    targetWPM,
    finalWords,
    isListening: isConnected,
  });

  const { countdownValue, startLeadIn } = useLeadIn();

  const streamRef = useRef<MediaStream | null>(null);

  // When stream becomes available, start Deepgram
  useEffect(() => {
    if (isRecording && stream && stream !== streamRef.current) {
      streamRef.current = stream;
      startDeepgram(stream);
    }
  }, [isRecording, stream, startDeepgram]);

  const handleRecord = useCallback(() => {
    setSessionDone(false);
    startLeadIn(async () => {
      await startRecording();
    });
  }, [startLeadIn, startRecording]);

  const handleStop = useCallback(() => {
    stopRecording();
    stopDeepgram();
    setSessionDone(true);
  }, [stopRecording, stopDeepgram]);

  const mergedTranscript = sessionDone
    ? mergedScript(tokens, transcript)
    : transcript;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
    >
      {/* Speed meter bar */}
      <SpeedMeter speedRatio={speedRatio} />

      {/* Lead-in countdown overlay */}
      <LeadInOverlay countdownValue={countdownValue} />

      {/* Teleprompter watermark label */}
      <div
        className="absolute top-4 left-6 select-none pointer-events-none"
        style={{
          fontSize: 'clamp(32px, 5vw, 64px)',
          color: 'rgba(255,255,255,0.08)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        Teleprompter
      </div>

      {/* RSVP display */}
      <RSVPDisplay word={currentWord} runway={runway} status={status} />

      {/* Bottom half: script + transcript panels */}
      <div className="flex-1 flex mt-[40vh] px-6 pb-24 gap-4 min-h-0">
        <div className="flex-1 min-h-0">
          <ScriptPanel tokens={tokens} currentIndex={currentIndex} />
        </div>
        <div className="flex-1 min-h-0">
          <TranscriptPanel transcript={mergedTranscript} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-6 z-40"
        style={{ backgroundColor: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)' }}
      >
        {dgError && (
          <p className="text-red-400 text-sm mr-4">{dgError}</p>
        )}

        {!isRecording && !sessionDone && (
          <button
            onClick={handleRecord}
            className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
            style={{ backgroundColor: '#EF4444', color: '#ffffff' }}
          >
            Record
          </button>
        )}

        {isRecording && (
          <button
            onClick={handleStop}
            className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
            style={{ backgroundColor: '#374151', color: '#ffffff' }}
          >
            Stop
          </button>
        )}

        {sessionDone && audioURL && (
          <div
            className="flex flex-col items-center gap-3 rounded-xl p-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Recording
            </p>
            <audio controls src={audioURL} className="w-64" />
            <button
              onClick={handleRecord}
              className="px-6 py-2 rounded-full font-semibold text-sm transition-colors"
              style={{ backgroundColor: '#ffffff', color: '#0a0a0a' }}
            >
              Record Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
