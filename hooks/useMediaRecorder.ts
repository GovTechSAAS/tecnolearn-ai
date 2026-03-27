"use client";

import { useState, useRef, useCallback } from 'react';

type RecorderState = 'idle' | 'requesting' | 'ready' | 'recording' | 'paused' | 'stopped';

export function useMediaRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const requestCamera = useCallback(async () => {
    try {
      setState('requesting');
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setState('ready');
      return mediaStream;
    } catch (err) {
      console.error("Failed to access camera", err);
      setState('idle');
      throw err;
    }
  }, []);

  const releaseCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setState('idle');
    setDuration(0);
    setVideoBlob(null);
    // Usar a referência direta se possível ou apenas limpar se existir
    setPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []); // Sem dependência de previewUrl!

  const start = useCallback(() => {
    if (!streamRef.current) return;

    // Detect supported MIME type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopTimer();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setState('stopped'); // Mudar para stopped APENAS aqui!
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100); // collect 100ms chunks
    setState('recording');
    startTimer();
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      stopTimer();
    }
  }, [state]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      startTimer();
    }
  }, [state]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      mediaRecorderRef.current.stop();
      // Não mudar estado imediatamente para stopped, deixar onstop lidar!
      stopTimer();
    }
  }, [state]);

  const reset = useCallback(() => {
    setVideoBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setDuration(0);
    if (streamRef.current) {
      setState('ready');
    } else {
      setState('idle');
    }
  }, [previewUrl]);

  const downloadVideo = useCallback(() => {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learnapp-aula-${Date.now()}.${videoBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [videoBlob]);

  const setExternalVideo = useCallback((file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setVideoBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setState('stopped');
  }, [previewUrl]);

  return {
    state,
    duration,
    previewUrl,
    videoBlob,
    stream,
    requestCamera,
    releaseCamera,
    start,
    pause,
    resume,
    stop,
    reset,
    setExternalVideo,
    downloadVideo
  };
}
