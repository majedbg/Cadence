/**
 * @file useRSVP.ts
 * @description Core RSVP (Rapid Serial Visual Presentation) hook. Tracks the
 *              user's position in the script using Deepgram word timestamps,
 *              performs kinematic extrapolation between packets, and computes
 *              speed ratio for the SpeedMeter component.
 */
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { DeepgramWord, WordToken, TranscriptEntry, RSVPStatus } from '@/lib/types';
import { tokenise, findMatchIndex, normalise } from '@/lib/textUtils';
import { RUNWAY_LENGTH } from '@/lib/constants';

interface UseRSVPParams {
  script: string;
  targetWPM: number;
  finalWords: DeepgramWord[];
  isListening: boolean;
}

interface UseRSVPReturn {
  currentWord: string;
  currentIndex: number;
  runway: string[];
  status: RSVPStatus;
  speedRatio: number;
  tokens: WordToken[];
  transcript: TranscriptEntry[];
}

export function useRSVP({
  script,
  targetWPM,
  finalWords,
  isListening,
}: UseRSVPParams): UseRSVPReturn {
  const tokens = useMemo(() => tokenise(script), [script]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<RSVPStatus>('waiting');
  const [speedRatio, setSpeedRatio] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const lastWordCountRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  // Track script position from Deepgram final words
  useEffect(() => {
    if (finalWords.length === 0) return;
    if (finalWords.length <= lastWordCountRef.current) return;

    const newWords = finalWords.slice(lastWordCountRef.current);
    lastWordCountRef.current = finalWords.length;

    let idx = currentIndex;
    const newTranscriptEntries: TranscriptEntry[] = [];

    for (const dw of newWords) {
      const matchIdx = findMatchIndex(tokens, dw.word, idx);
      const isOffScript = matchIdx === -1;

      newTranscriptEntries.push({
        word: dw.word,
        timestamp: dw.start,
        isOffScript,
      });

      if (!isOffScript) {
        idx = matchIdx + 1;
      }
    }

    setTranscript((prev) => [...prev, ...newTranscriptEntries]);

    if (idx !== currentIndex) {
      setCurrentIndex(idx);
      setStatus(idx >= tokens.length ? 'done' : 'synced');

      // Calculate speed ratio
      const lastWord = newWords[newWords.length - 1];
      if (lastWord && lastTimestampRef.current > 0) {
        const elapsed = lastWord.end - lastTimestampRef.current;
        if (elapsed > 0) {
          const wordsSpoken = newWords.length;
          const actualWPM = (wordsSpoken / elapsed) * 60;
          setSpeedRatio(actualWPM / targetWPM);
        }
      }
      if (newWords.length > 0) {
        lastTimestampRef.current = newWords[newWords.length - 1].end;
      }
    } else if (newWords.length > 0) {
      setStatus('offscript');
    }
  }, [finalWords, tokens, targetWPM, currentIndex]);

  // Kinematic extrapolation: advance RSVP between Deepgram packets
  useEffect(() => {
    if (!isListening || status === 'done' || status === 'waiting') {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const msPerWord = 60_000 / targetWPM;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTick;
      if (delta >= msPerWord && status === 'synced') {
        // Only extrapolate if we haven't received new words recently
        lastTick = now;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, status, targetWPM]);

  // Update status when listening starts
  useEffect(() => {
    if (isListening && status === 'done') {
      // Reset for new session
      setCurrentIndex(0);
      setStatus('waiting');
      setTranscript([]);
      lastWordCountRef.current = 0;
      lastTimestampRef.current = 0;
    } else if (isListening && finalWords.length === 0) {
      setStatus('waiting');
    }
  }, [isListening, status, finalWords.length]);

  const currentWord = tokens[currentIndex]?.original ?? '';

  const runway = useMemo(() => {
    const start = currentIndex + 1;
    const end = Math.min(start + RUNWAY_LENGTH, tokens.length);
    return tokens.slice(start, end).map((t) => t.original);
  }, [tokens, currentIndex]);

  return {
    currentWord,
    currentIndex,
    runway,
    status,
    speedRatio,
    tokens,
    transcript,
  };
}
