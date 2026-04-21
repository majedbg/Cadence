/**
 * @file useMediaRecorder.ts
 * @description Hook that manages getUserMedia (mic + optional camera) and
 *              records the combined stream with MediaRecorder. Stream
 *              acquisition is separable from recording so the caller can
 *              show a live camera preview before a take begins.
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface StartOptions {
  /** When true, include a video track and record a video/webm file. */
  video?: boolean;
}

interface UseMediaRecorderReturn {
  isRecording: boolean;
  /** Blob URL for the most recent completed take (audio-only or video+audio). */
  mediaURL: string | null;
  /** True when the recorded blob contains a video track. */
  hasVideo: boolean;
  /** Live stream — available after initStream() or startRecording(). */
  stream: MediaStream | null;
  initStream: (options?: StartOptions) => Promise<MediaStream>;
  startRecording: (options?: StartOptions) => Promise<void>;
  stopRecording: () => void;
}

function pickMimeType(video: boolean): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = video
    ? [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : ['audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export function useMediaRecorder(): UseMediaRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedMimeRef = useRef<string>('audio/webm');

  const initStream = useCallback(
    async (options: StartOptions = {}): Promise<MediaStream> => {
      const wantVideo = !!options.video;
      const existing = streamRef.current;
      if (existing) {
        const hasVideoTrack = existing.getVideoTracks().length > 0;
        if (hasVideoTrack === wantVideo) return existing;
        // Reconfiguring — tear down the old stream before acquiring new one.
        existing.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
      }

      const next = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: wantVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
              frameRate: { ideal: 30 },
            }
          : false,
      });
      streamRef.current = next;
      setStream(next);
      return next;
    },
    []
  );

  const startRecording = useCallback(
    async (options: StartOptions = {}) => {
      setMediaURL(null);
      chunksRef.current = [];

      const activeStream = await initStream(options);
      const wantVideo = !!options.video;
      const mimeType = pickMimeType(wantVideo);

      const recorder = mimeType
        ? new MediaRecorder(activeStream, { mimeType })
        : new MediaRecorder(activeStream);
      recorderRef.current = recorder;
      recordedMimeRef.current = recorder.mimeType || (wantVideo ? 'video/webm' : 'audio/webm');
      setHasVideo(wantVideo);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recordedMimeRef.current });
        setMediaURL(URL.createObjectURL(blob));
        setIsRecording(false);
      };

      recorder.start(250);
      setIsRecording(true);
    },
    [initStream]
  );

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    // Intentionally keep the stream alive so the preview persists between
    // takes. Tracks are released on unmount.
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    mediaURL,
    hasVideo,
    stream,
    initStream,
    startRecording,
    stopRecording,
  };
}
