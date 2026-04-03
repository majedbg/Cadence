/**
 * @file page.tsx (calibrate)
 * @description Screen 2 — WPM Calibration. The user reads a fixed passage
 *              aloud for 10 seconds. Deepgram transcribes it, and the app
 *              calculates their natural words-per-minute reading pace.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDeepgram } from '@/hooks/useDeepgram';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { calculateWPM, classifyWPM } from '@/lib/textUtils';
import {
  CALIBRATION_PASSAGE,
  CALIBRATION_DURATION_MS,
  STORAGE_KEY_WPM,
} from '@/lib/constants';
import WPMResultCard from '@/components/WPMResultCard';

export default function CalibratePage() {
  const router = useRouter();
  const { finalWords, isConnected, error, start: startDeepgram, stop: stopDeepgram } = useDeepgram();
  const { isRecording, stream, startRecording, stopRecording } = useMediaRecorder();

  const [calibratedWPM, setCalibratedWPM] = useState<number | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleRecord = useCallback(async () => {
    setIsCalibrating(true);
    setCalibratedWPM(null);

    await startRecording();
  }, [startRecording]);

  // When stream becomes available after startRecording, begin Deepgram
  useEffect(() => {
    if (isRecording && stream && stream !== streamRef.current) {
      streamRef.current = stream;
      startDeepgram(stream);

      // Auto-stop after calibration duration
      timerRef.current = setTimeout(() => {
        stopRecording();
        stopDeepgram();
        setIsCalibrating(false);
      }, CALIBRATION_DURATION_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRecording, stream, startDeepgram, stopDeepgram, stopRecording]);

  // Calculate WPM when calibration stops and we have words
  useEffect(() => {
    if (!isCalibrating && !isRecording && finalWords.length > 0 && calibratedWPM === null) {
      const wpm = calculateWPM(finalWords.length, CALIBRATION_DURATION_MS);
      setCalibratedWPM(wpm);
      sessionStorage.setItem(STORAGE_KEY_WPM, String(Math.round(wpm)));
    }
  }, [isCalibrating, isRecording, finalWords, calibratedWPM]);

  const handleNext = () => {
    router.push('/session');
  };

  const handleSkip = () => {
    router.push('/session');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: '#0a0a0a', color: '#ffffff' }}
    >
      <h1 className="text-3xl font-bold mb-2 text-center">
        First things first — what is your reading pace?
      </h1>
      <p
        className="text-lg mb-8 text-center"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Hit Record when ready, grant microphone access, and read the passage below.
      </p>

      <div
        className="max-w-2xl w-full rounded-xl p-6 mb-8 leading-relaxed text-lg"
        style={{ backgroundColor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)' }}
      >
        {CALIBRATION_PASSAGE}
      </div>

      {error && (
        <p className="text-red-400 mb-4 text-sm">{error}</p>
      )}

      {calibratedWPM === null ? (
        <button
          onClick={handleRecord}
          disabled={isCalibrating}
          className="px-8 py-3 rounded-full font-semibold text-lg transition-colors disabled:opacity-50"
          style={{
            backgroundColor: isCalibrating ? '#374151' : '#EF4444',
            color: '#ffffff',
          }}
        >
          {isCalibrating ? `Recording… (${Math.round(CALIBRATION_DURATION_MS / 1000)}s)` : 'Record'}
        </button>
      ) : (
        <div className="w-full max-w-md">
          <WPMResultCard wpm={calibratedWPM} range={classifyWPM(calibratedWPM)} />
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
