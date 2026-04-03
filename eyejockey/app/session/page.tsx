/**
 * @file page.tsx (session)
 * @description Screen 3 — Teleprompter Session. Full viewport RSVP display
 *              with live Deepgram transcription, script tracking, speed meter,
 *              and recording playback. Completed takes accumulate in the right
 *              panel as expandable cards with transcript and downloadable audio.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDeepgram } from "@/hooks/useDeepgram";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useRSVP } from "@/hooks/useRSVP";
import { useLeadIn } from "@/hooks/useLeadIn";
import { useDelaySettings } from "@/hooks/useDelaySettings";
import type { TranscriptEntry } from "@/lib/types";
import {
  DEFAULT_SCRIPT,
  WPM_TARGET,
  STORAGE_KEY_SCRIPT,
  STORAGE_KEY_WPM,
} from "@/lib/constants";

import SpeedMeter from "@/components/SpeedMeter";
import RSVPDisplay from "@/components/RSVPDisplay";
import ScriptPanel from "@/components/ScriptPanel";
import TranscriptPanel from "@/components/TranscriptPanel";
import LeadInOverlay from "@/components/LeadInOverlay";
import SettingsPopper from "@/components/SettingsPopper";
import ConnectionStatus from "@/components/ConnectionStatus";
import TakeCard from "@/components/TakeCard";

interface Take {
  number: number;
  transcript: TranscriptEntry[];
  audioURL: string;
}

export default function SessionPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [targetWPM, setTargetWPM] = useState(WPM_TARGET);
  const [sessionDone, setSessionDone] = useState(false);
  const [takes, setTakes] = useState<Take[]>([]);
  const { delays, setDelay, resetToDefaults } = useDelaySettings();

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
    connectionState,
    error: dgError,
    start: startDeepgram,
    stop: stopDeepgram,
  } = useDeepgram();

  const { isRecording, audioURL, stream, startRecording, stopRecording } =
    useMediaRecorder();

  const {
    currentWord,
    displayIndex,
    confirmedIndex,
    runway,
    status,
    speedRatio,
    wordStates,
    transcript,
    delayProgress,
    isDrifting,
  } = useRSVP({
    script,
    targetWPM,
    finalWords,
    isListening: isConnected,
    delaySettings: delays,
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

  // Save take when recording finishes and audioURL is ready
  useEffect(() => {
    if (sessionDone && audioURL) {
      // Only add if we haven't already saved this URL
      setTakes((prev) => {
        const alreadySaved = prev.some((t) => t.audioURL === audioURL);
        if (alreadySaved) return prev;
        return [
          ...prev,
          {
            number: prev.length + 1,
            transcript: [...transcript],
            audioURL,
          },
        ];
      });
    }
  }, [sessionDone, audioURL, transcript]);

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

  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: "#0a0a0a", color: "#ffffff" }}
    >
      {/* Speed meter bar */}
      <SpeedMeter speedRatio={speedRatio} />

      {/* Lead-in countdown overlay */}
      <LeadInOverlay countdownValue={countdownValue} />

      {/* Top-left: Connection status + WPM control */}
      <div className="absolute top-4 left-6 z-30 flex items-start gap-4">
        <div className="mt-2">
          <ConnectionStatus state={connectionState} />
        </div>
        {/* Editable WPM control */}
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min={60}
            max={300}
            value={targetWPM}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 60 && v <= 300) setTargetWPM(v);
            }}
            className="w-16 text-center text-sm font-bold rounded-md focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "4px 2px",
            }}
          />
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            WPM
          </span>
        </div>
      </div>

      {/* Settings popper (top-right) */}
      <div className="absolute top-4 right-6 z-40">
        <SettingsPopper
          delays={delays}
          onSetDelay={setDelay}
          onReset={resetToDefaults}
        />
      </div>

      {/* RSVP display */}
      <RSVPDisplay
        word={currentWord}
        nextWord={runway[0] ?? ""}
        runway={runway}
        status={status}
        delayProgress={delayProgress}
        isDrifting={isDrifting}
      />

      {/* Bottom half: script panel + right panel (transcript or takes) */}
      <div className="flex-1 flex mt-[15vh] px-6 pb-24 gap-4 min-h-0">
        {/* Left: Script panel with blue glow during recording */}
        <div
          className="flex-1 min-h-0 rounded-xl"
          style={{
            border: isRecording
              ? "1px solid rgba(59,130,246,0.4)"
              : "1px solid transparent",
            boxShadow: isRecording
              ? "0 0 20px rgba(59,130,246,0.15), 0 0 40px rgba(59,130,246,0.05)"
              : "none",
            transition: "border 400ms ease, box-shadow 400ms ease",
          }}
        >
          <ScriptPanel wordStates={wordStates} displayIndex={displayIndex} />
        </div>

        {/* Right: Live transcript during recording, Takes list when not recording */}
        <div className="flex-1 min-h-0 flex flex-col">
          {isRecording ? (
            <TranscriptPanel transcript={transcript} />
          ) : takes.length > 0 ? (
            <div
              className="flex flex-col h-full overflow-y-scroll rounded-xl p-4 gap-3"
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <p
                className="text-xs uppercase tracking-widest mb-1"
                style={{ color: "rgba(255,255,255,0.2)" }}
              >
                Takes
              </p>
              {takes.map((take) => (
                <TakeCard
                  key={take.number}
                  takeNumber={take.number}
                  transcript={take.transcript}
                  audioURL={take.audioURL}
                  defaultExpanded={take.number === takes.length}
                />
              ))}
            </div>
          ) : (
            <TranscriptPanel transcript={transcript} />
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-6 z-40"
        style={{
          backgroundColor: "rgba(10,10,10,0.9)",
          backdropFilter: "blur(8px)",
        }}
      >
        {dgError && <p className="text-red-400 text-sm mr-4">{dgError}</p>}

        {!isRecording && !sessionDone && (
          <button
            onClick={handleRecord}
            className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
            style={{ backgroundColor: "#EF4444", color: "#ffffff" }}
          >
            Record
          </button>
        )}

        {isRecording && (
          <button
            onClick={handleStop}
            className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
            style={{ backgroundColor: "#374151", color: "#ffffff" }}
          >
            Stop
          </button>
        )}

        {sessionDone && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleRecord}
              className="px-8 py-3 rounded-full font-semibold text-lg transition-colors"
              style={{ backgroundColor: "#EF4444", color: "#ffffff" }}
            >
              Take {takes.length + 1}
            </button>
            <span
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: "#A855F7",
                }}
              />
              <span style={{ color: "#A855F7" }}>Purple</span> = off-script
              words
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
