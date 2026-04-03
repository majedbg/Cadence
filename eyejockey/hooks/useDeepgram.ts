/**
 * @file useDeepgram.ts
 * @description Hook that manages a WebSocket connection to Deepgram's
 *              streaming speech-to-text API. Accumulates final words with
 *              timestamps and exposes interim transcript for UI display.
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

export function useDeepgram(): UseDeepgramReturn {
  const [finalWords, setFinalWords] = useState<DeepgramWord[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<DGConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (socketRef.current) {
      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionState('idle');
  }, []);

  const start = useCallback(
    (stream: MediaStream) => {
      // Reset state
      setFinalWords([]);
      setInterimTranscript('');
      setError(null);
      setConnectionState('connecting');

      // Fetch API key from our server route
      fetch('/api/deepgram-token')
        .then((res) => res.json())
        .then((data: { key?: string; error?: string }) => {
          if (data.error || !data.key) {
            setError(data.error ?? 'Failed to get Deepgram key');
            setConnectionState('error');
            return;
          }

          const wsUrl =
            'wss://api.deepgram.com/v1/listen?' +
            'model=nova-2&' +
            'language=en&' +
            'smart_format=true&' +
            'interim_results=true&' +
            'utterance_end_ms=1000&' +
            'vad_events=true';

          const ws = new WebSocket(wsUrl, ['token', data.key]);
          socketRef.current = ws;

          ws.onopen = () => {
            setIsConnected(true);
            setConnectionState('connected');

            // Start sending audio via MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'audio/webm;codecs=opus',
            });
            recorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(event.data);
              }
            };

            mediaRecorder.start(250); // send chunks every 250ms
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
          };

          ws.onclose = () => {
            setIsConnected(false);
            setConnectionState((prev) => prev === 'error' ? prev : 'idle');
          };
        })
        .catch((err: Error) => {
          setError(err.message);
          setConnectionState('error');
        });
    },
    []
  );

  // Cleanup WebSocket and MediaRecorder on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      recorderRef.current = null;

      if (socketRef.current) {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
        socketRef.current = null;
      }
    };
  }, []);

  return { finalWords, interimTranscript, isConnected, connectionState, error, start, stop };
}
