/**
 * @file useRSVP.ts
 * @description Core RSVP (Rapid Serial Visual Presentation) hook with per-word
 *              state tracking. Uses a two-tier architecture:
 *
 *              Tier 1 — Refs mutated at 60fps inside rAF (authoritative state).
 *              Tier 2 — React state flushed every STATE_FLUSH_INTERVAL_MS for rendering.
 *
 *              The rAF loop is the PRIMARY word advancement driver at the user's
 *              target WPM. Deepgram speech-to-text acts as a verification/sync layer:
 *              it confirms spoken words, detects off-script speech, drift, and silence,
 *              then re-syncs when the user returns to the script.
 *
 *              Two index concepts: `displayIndex` (timer-driven, optimistic) and
 *              `confirmedIndex` (last word verified by Deepgram). When drift or
 *              off-script is detected, we rewind to confirmed. Each word carries its
 *              own WordState lifecycle: planned → displayed → confirmed | unconfirmed.
 */
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  DeepgramWord,
  WordToken,
  WordState,
  OffScriptEntry,
  TranscriptEntry,
  RSVPStatus,
  RSVPState,
  DelaySettings,
} from '@/lib/types';
import { tokenise, findMatchIndex, computeDelayMs, deriveTranscript } from '@/lib/textUtils';
import {
  RUNWAY_LENGTH,
  OFFSCRIPT_THRESHOLD,
  RESYNC_MATCH_THRESHOLD,
  DRIFT_THRESHOLD,
  SILENCE_TIMEOUT_MS,
  REWIND_BUFFER,
  STATE_FLUSH_INTERVAL_MS,
} from '@/lib/constants';

interface UseRSVPParams {
  script: string;
  targetWPM: number;
  finalWords: DeepgramWord[];
  isListening: boolean;
  delaySettings: DelaySettings;
}

function buildWordStates(tokens: WordToken[]): WordState[] {
  return tokens.map((token) => ({
    token,
    status: 'planned',
    displayedAt: null,
    confirmedAt: null,
    confirmedWith: null,
  }));
}

export function useRSVP({
  script,
  targetWPM,
  finalWords,
  isListening,
  delaySettings,
}: UseRSVPParams): RSVPState {
  // ── Derived data ──────────────────────────────────────────────────────
  const tokens = useMemo(() => tokenise(script), [script]);

  // ── Tier 2: React state (for rendering, flushed every 100ms) ─────────
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [confirmedIndex, setConfirmedIndex] = useState(0);
  const [isDrifting, setIsDrifting] = useState(false);
  const [status, setStatus] = useState<RSVPStatus>('waiting');
  const [speedRatio, setSpeedRatio] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [delayProgress, setDelayProgress] = useState<number | null>(null);

  // ── Tier 1: Refs (mutable state for rAF tick — avoids stale closures) ─
  const wordStatesRef = useRef<WordState[]>([]);
  const offScriptEntriesRef = useRef<OffScriptEntry[]>([]);
  const displayIndexRef = useRef(0);
  const confirmedIndexRef = useRef(0);
  const lastDGWordTimeRef = useRef(0);
  const isDriftingRef = useRef(false);
  const statusRef = useRef<RSVPStatus>('waiting');
  const accumulatorRef = useRef(0);
  const delayRemainingRef = useRef(0);
  const delayTotalRef = useRef(0);
  const delaySettingsRef = useRef<DelaySettings>(delaySettings);
  const consecutiveMissesRef = useRef(0);
  const consecutiveMatchesRef = useRef(0);     // tracks sequential matches during offscript for re-sync
  const pendingResyncIndexRef = useRef(0);     // the first match index in a potential re-sync sequence
  const animFrameRef = useRef(0);
  const lastWordCountRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep delaySettingsRef in sync with the prop
  useEffect(() => {
    delaySettingsRef.current = delaySettings;
  }, [delaySettings]);

  // ── Helpers: update both ref and React state ─────────────────────────
  const updateDisplayIndex = useCallback((i: number) => {
    displayIndexRef.current = i;
  }, []);

  const updateStatus = useCallback((s: RSVPStatus) => {
    statusRef.current = s;
  }, []);

  // ── Reset when script changes ─────────────────────────────────────────
  useEffect(() => {
    const ws = buildWordStates(tokens);
    wordStatesRef.current = ws;
    offScriptEntriesRef.current = [];
    displayIndexRef.current = 0;
    confirmedIndexRef.current = 0;
    lastDGWordTimeRef.current = 0;
    isDriftingRef.current = false;
    statusRef.current = 'waiting';
    accumulatorRef.current = 0;
    delayRemainingRef.current = 0;
    delayTotalRef.current = 0;
    consecutiveMissesRef.current = 0;
    consecutiveMatchesRef.current = 0;
    pendingResyncIndexRef.current = 0;
    lastWordCountRef.current = 0;
    lastTimestampRef.current = 0;

    setWordStates(ws);
    setDisplayIndex(0);
    setConfirmedIndex(0);
    setIsDrifting(false);
    setStatus('waiting');
    setSpeedRatio(1);
    setTranscript([]);
    setDelayProgress(null);
  }, [tokens]);

  // ── Session start: isListening false→true ────────────────────────────
  const prevListeningRef = useRef(false);
  useEffect(() => {
    const wasListening = prevListeningRef.current;
    prevListeningRef.current = isListening;

    if (isListening && !wasListening) {
      const ws = buildWordStates(tokens);
      wordStatesRef.current = ws;
      offScriptEntriesRef.current = [];
      displayIndexRef.current = 0;
      confirmedIndexRef.current = 0;
      lastDGWordTimeRef.current = performance.now();
      isDriftingRef.current = false;
      statusRef.current = 'synced';
      accumulatorRef.current = 0;
      delayRemainingRef.current = 0;
      delayTotalRef.current = 0;
      consecutiveMissesRef.current = 0;
      lastWordCountRef.current = 0;
      lastTimestampRef.current = 0;

      setWordStates(ws);
      setDisplayIndex(0);
      setConfirmedIndex(0);
      setIsDrifting(false);
      setStatus('synced');
      setSpeedRatio(1);
      setTranscript([]);
      setDelayProgress(null);
    }
  }, [isListening, tokens]);

  // ── Flush interval: Tier 1 → Tier 2 every 100ms ─────────────────────
  useEffect(() => {
    if (!isListening) {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      return;
    }

    const flush = () => {
      setWordStates([...wordStatesRef.current]);
      setDisplayIndex(displayIndexRef.current);
      setConfirmedIndex(confirmedIndexRef.current);
      setIsDrifting(isDriftingRef.current);
      setStatus(statusRef.current);
      setTranscript(
        deriveTranscript(wordStatesRef.current, offScriptEntriesRef.current)
      );
    };

    flushIntervalRef.current = setInterval(flush, STATE_FLUSH_INTERVAL_MS);

    return () => {
      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
    };
  }, [isListening]);

  // ── rAF loop: PRIMARY word advancement driver ─────────────────────────
  useEffect(() => {
    if (!isListening || tokens.length === 0) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const msPerWord = 60_000 / targetWPM;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const rawDelta = now - lastTick;
      const delta = Math.min(rawDelta, msPerWord * 2); // clamp for tab blur
      lastTick = now;

      // Only advance when synced
      if (statusRef.current !== 'synced') {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Drift / silence detection (BEFORE punctuation/advancement) ──
      const gap = displayIndexRef.current - confirmedIndexRef.current;
      const effectiveThreshold = Math.max(
        3,
        Math.min(DRIFT_THRESHOLD, Math.floor(tokens.length / 2))
      );
      const silence = now - lastDGWordTimeRef.current;

      if (
        gap > effectiveThreshold ||
        (gap > 4 && silence > SILENCE_TIMEOUT_MS)
      ) {
        // Mark displayed-but-unconfirmed words
        const ws = wordStatesRef.current;
        for (let i = confirmedIndexRef.current; i < displayIndexRef.current; i++) {
          if (i < ws.length && ws[i].status === 'displayed') {
            ws[i].status = 'unconfirmed';
          }
        }

        // Rewind
        const rewindTarget = Math.min(
          confirmedIndexRef.current + REWIND_BUFFER,
          tokens.length - 1
        );
        displayIndexRef.current = rewindTarget;
        isDriftingRef.current = true;
        accumulatorRef.current = 0;
        delayRemainingRef.current = 0;

        animFrameRef.current = requestAnimationFrame(tick);
        return; // don't advance this frame
      }

      // ── User speaks faster than timer: snap forward ──
      if (confirmedIndexRef.current > displayIndexRef.current) {
        displayIndexRef.current = confirmedIndexRef.current;
        accumulatorRef.current = 0;
      }

      // ── Phase 1: Punctuation delay in progress ──
      if (delayRemainingRef.current > 0) {
        delayRemainingRef.current -= delta;
        const progress =
          1 - delayRemainingRef.current / delayTotalRef.current;
        setDelayProgress(Math.max(0, Math.min(1, progress)));

        if (delayRemainingRef.current <= 0) {
          delayRemainingRef.current = 0;
          setDelayProgress(null);
        }

        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      // ── Phase 2: Word advancement ──
      accumulatorRef.current += delta;

      if (accumulatorRef.current >= msPerWord) {
        accumulatorRef.current -= msPerWord;

        const prevToken = tokens[displayIndexRef.current];
        const punctDelay = prevToken
          ? computeDelayMs(prevToken, delaySettingsRef.current)
          : 0;

        const newIndex = displayIndexRef.current + 1;

        if (newIndex >= tokens.length) {
          displayIndexRef.current = tokens.length;
          statusRef.current = 'done';
          animFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        // Mark the new word as displayed
        const ws = wordStatesRef.current;
        if (newIndex < ws.length) {
          ws[newIndex].status = 'displayed';
          ws[newIndex].displayedAt = now;
        }
        displayIndexRef.current = newIndex;

        if (punctDelay > 0) {
          delayRemainingRef.current = punctDelay;
          delayTotalRef.current = punctDelay;
          setDelayProgress(0);
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isListening, targetWPM, tokens]);

  // ── Deepgram sync effect (verification/sync layer) ────────────────────
  useEffect(() => {
    if (finalWords.length === 0) return;
    if (finalWords.length <= lastWordCountRef.current) return;

    const newWords = finalWords.slice(lastWordCountRef.current);
    lastWordCountRef.current = finalWords.length;

    const ws = wordStatesRef.current;

    for (const dw of newWords) {
      const searchFrom = confirmedIndexRef.current;
      const matchIdx = findMatchIndex(tokens, dw.word, searchFrom);

      const currentlyOffScript = statusRef.current === 'offscript';

      if (matchIdx !== -1 && !currentlyOffScript) {
        // ── Match found while synced — normal confirmation ──
        consecutiveMissesRef.current = 0;
        confirmedIndexRef.current = matchIdx + 1;
        lastDGWordTimeRef.current = performance.now();

        if (matchIdx < ws.length) {
          ws[matchIdx].status = 'confirmed';
          ws[matchIdx].confirmedAt = performance.now();
          ws[matchIdx].confirmedWith = dw.word;
        }

        if (isDriftingRef.current) {
          isDriftingRef.current = false;
          displayIndexRef.current = matchIdx + 1;
          accumulatorRef.current = 0;
        }

      } else if (matchIdx !== -1 && currentlyOffScript) {
        // ── Match found while off-script — tentative, require N consecutive ──
        // Check if this match is sequential (next expected position)
        const expectedNext = pendingResyncIndexRef.current > 0
          ? pendingResyncIndexRef.current
          : matchIdx;

        if (matchIdx === expectedNext || consecutiveMatchesRef.current === 0) {
          // Sequential match or first match in potential re-sync
          if (consecutiveMatchesRef.current === 0) {
            pendingResyncIndexRef.current = matchIdx;
          }
          consecutiveMatchesRef.current += 1;
          pendingResyncIndexRef.current = matchIdx + 1;
          lastDGWordTimeRef.current = performance.now();

          if (consecutiveMatchesRef.current >= RESYNC_MATCH_THRESHOLD) {
            // Confirmed re-sync — commit all matched words
            const startIdx = matchIdx - consecutiveMatchesRef.current + 1;
            for (let i = startIdx; i <= matchIdx; i++) {
              if (i >= 0 && i < ws.length) {
                ws[i].status = 'confirmed';
                ws[i].confirmedAt = performance.now();
                ws[i].confirmedWith = ws[i].token.normalised;
              }
            }

            confirmedIndexRef.current = matchIdx + 1;
            displayIndexRef.current = matchIdx + 1;
            accumulatorRef.current = 0;
            delayRemainingRef.current = 0;
            statusRef.current = 'synced';
            consecutiveMatchesRef.current = 0;
            consecutiveMissesRef.current = 0;
            pendingResyncIndexRef.current = 0;

            if (isDriftingRef.current) {
              isDriftingRef.current = false;
            }
          }
        } else {
          // Non-sequential match — reset the re-sync attempt, treat as off-script
          consecutiveMatchesRef.current = 0;
          pendingResyncIndexRef.current = 0;
          offScriptEntriesRef.current.push({
            word: dw.word,
            timestamp: performance.now(),
            afterTokenIndex: confirmedIndexRef.current,
          });
        }

      } else {
        // ── No match ──
        consecutiveMissesRef.current += 1;
        consecutiveMatchesRef.current = 0;
        pendingResyncIndexRef.current = 0;
        lastDGWordTimeRef.current = performance.now();

        offScriptEntriesRef.current.push({
          word: dw.word,
          timestamp: performance.now(),
          afterTokenIndex: confirmedIndexRef.current,
        });

        if (
          consecutiveMissesRef.current >= OFFSCRIPT_THRESHOLD &&
          statusRef.current === 'synced'
        ) {
          for (
            let i = confirmedIndexRef.current;
            i < displayIndexRef.current;
            i++
          ) {
            if (i < ws.length && ws[i].status === 'displayed') {
              ws[i].status = 'unconfirmed';
            }
          }

          displayIndexRef.current = confirmedIndexRef.current;
          accumulatorRef.current = 0;
          delayRemainingRef.current = 0;
          statusRef.current = 'offscript';
        }
      }
    }

    // Compute speed ratio from Deepgram timestamps
    const lastWord = newWords[newWords.length - 1];
    if (lastWord && lastTimestampRef.current > 0) {
      const elapsed = lastWord.end - lastTimestampRef.current;
      if (elapsed > 0) {
        const actualWPM = (newWords.length / elapsed) * 60;
        setSpeedRatio(actualWPM / targetWPM);
      }
    }
    if (lastWord) {
      lastTimestampRef.current = lastWord.end;
    }
  }, [finalWords, tokens, targetWPM]);

  // ── Derived rendering values ──────────────────────────────────────────
  const currentWord = tokens[displayIndex]?.original ?? '';

  const runway = useMemo(() => {
    const start = displayIndex + 1;
    const end = Math.min(start + RUNWAY_LENGTH, tokens.length);
    return tokens.slice(start, end).map((t) => t.original);
  }, [tokens, displayIndex]);

  return {
    currentWord,
    displayIndex,
    confirmedIndex,
    runway,
    status,
    speedRatio,
    tokens,
    wordStates,
    transcript,
    delayProgress,
    isDrifting,
  };
}
