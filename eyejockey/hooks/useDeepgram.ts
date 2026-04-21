/**
 * @file useDeepgram.ts
 * @description Hook that manages a WebSocket connection to Deepgram's
 *              streaming speech-to-text API. Streams raw 16-bit PCM
 *              (linear16) captured via an AudioWorklet in ~50 ms chunks
 *              for low latency. Accumulates final words with timestamps
 *              and exposes interim transcript for UI display.
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { DeepgramWord } from '@/lib/types';

export type DGConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

interface UseDeepgramReturn {
  finalWords: DeepgramWord[];
  interimTranscript: string;
  isConnected: boolean;
  connectionState: DGConnectionState;
  error: string | null;
  start: (stream: MediaStream) => void;
  stop: () => void;
}

const CHUNK_MS = 50;
const TARGET_SAMPLE_RATE = 16000;

export function useDeepgram(): UseDeepgramReturn {
  const [finalWords, setFinalWords] = useState<DeepgramWord[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<DGConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const teardownAudio = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      try { workletNodeRef.current.disconnect(); } catch {}
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      ctx.close().catch(() => {});
    }
  }, []);

  const stop = useCallback(() => {
    teardownAudio();

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        // Send CloseStream message so Deepgram flushes any buffered results.
        try { socketRef.current.send(JSON.stringify({ type: 'CloseStream' })); } catch {}
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionState('idle');
  }, [teardownAudio]);

  const start = useCallback(
    (stream: MediaStream) => {
      setFinalWords([]);
      setInterimTranscript('');
      setError(null);
      setConnectionState('connecting');

      fetch('/api/deepgram-token')
        .then((res) => res.json())
        .then(async (data: { key?: string; error?: string }) => {
          if (data.error || !data.key) {
            setError(data.error ?? 'Failed to get Deepgram key');
            setConnectionState('error');
            return;
          }

          // Set up audio graph first so we know the actual sample rate before
          // opening the WebSocket (Deepgram needs it in the URL params).
          let audioContext: AudioContext;
          try {
            audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
          } catch {
            audioContext = new AudioContext();
          }
          audioContextRef.current = audioContext;

          try {
            await audioContext.audioWorklet.addModule('/pcm-worklet.js');
          } catch (err) {
            setError(`Failed to load audio worklet: ${(err as Error).message}`);
            setConnectionState('error');
            teardownAudio();
            return;
          }

          const sampleRate = audioContext.sampleRate;

          const wsUrl =
            'wss://api.deepgram.com/v1/listen?' +
            'model=nova-3&' +
            'language=en&' +
            'smart_format=true&' +
            'interim_results=true&' +
            'encoding=linear16&' +
            `sample_rate=${sampleRate}&` +
            'channels=1&' +
            'endpointing=300&' +
            'utterance_end_ms=1000&' +
            'vad_events=true';

          const ws = new WebSocket(wsUrl, ['token', data.key]);
          ws.binaryType = 'arraybuffer';
          socketRef.current = ws;

          ws.onopen = () => {
            setIsConnected(true);
            setConnectionState('connected');

            // Guard against races: start() may have been superseded by stop().
            if (!audioContextRef.current || audioContextRef.current !== audioContext) {
              return;
            }

            const source = audioContext.createMediaStreamSource(stream);
            sourceNodeRef.current = source;

            const worklet = new AudioWorkletNode(audioContext, 'pcm-worklet', {
              numberOfInputs: 1,
              numberOfOutputs: 0,
              channelCount: 1,
              processorOptions: { chunkMs: CHUNK_MS },
            });
            workletNodeRef.current = worklet;

            worklet.port.onmessage = (event) => {
              const buf = event.data as ArrayBuffer;
              if (ws.readyState === WebSocket.OPEN && buf.byteLength > 0) {
                ws.send(buf);
              }
            };

            source.connect(worklet);
          };

          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as {
              type?: string;
              channel?: {
                alternatives?: Array<{
                  transcript?: string;
                  words?: DeepgramWord[];
                }>;
              };
              is_final?: boolean;
            };

            if (msg.type !== 'Results' || !msg.channel?.alternatives?.[0]) return;

            const alt = msg.channel.alternatives[0];

            if (msg.is_final && alt.words && alt.words.length > 0) {
              setFinalWords((prev) => [...prev, ...alt.words!]);
              setInterimTranscript('');
            } else if (alt.transcript) {
              setInterimTranscript(alt.transcript);
            }
          };

          ws.onerror = () => {
            setError('WebSocket connection error');
            setIsConnected(false);
            setConnectionState('error');
            teardownAudio();
          };

          ws.onclose = () => {
            setIsConnected(false);
            setConnectionState((prev) => prev === 'error' ? prev : 'idle');
            teardownAudio();
          };
        })
        .catch((err: Error) => {
          setError(err.message);
          setConnectionState('error');
          teardownAudio();
        });
    },
    [teardownAudio]
  );

  useEffect(() => {
    return () => {
      teardownAudio();
      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
        socketRef.current = null;
      }
    };
  }, [teardownAudio]);

  return { finalWords, interimTranscript, isConnected, connectionState, error, start, stop };
}
