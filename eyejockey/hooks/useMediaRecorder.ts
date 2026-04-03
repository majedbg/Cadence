/**
 * @file useMediaRecorder.ts
 * @description Hook that manages browser microphone access via getUserMedia
 *              and records audio using MediaRecorder. Produces a playable
 *              audio blob URL after stopping.
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMediaRecorderReturn {
  isRecording: boolean;
  audioURL: string | null;
  stream: MediaStream | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    // Clean up previous URL
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    chunksRef.current = [];

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });
    streamRef.current = mediaStream;

    const recorder = new MediaRecorder(mediaStream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioURL(URL.createObjectURL(blob));
      setIsRecording(false);
    };

    recorder.start(250);
    setIsRecording(true);
  }, [audioURL]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  // Cleanup on unmount: stop recording and revoke object URL
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    audioURL,
    stream: streamRef.current,
    startRecording,
    stopRecording,
  };
}
