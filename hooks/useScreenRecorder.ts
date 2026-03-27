"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

export type ScreenRecorderState = 'idle' | 'requesting' | 'previewing' | 'recording' | 'paused' | 'stopped';

export function useScreenRecorder() {
  const [state, setState] = useState<ScreenRecorderState>('idle');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Streams
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  // Media elements for canvas draw
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Recorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mic gain node (for mute without stopping stream)
  const micGainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const screenVid = screenVideoRef.current;
    if (!canvas || !screenVid) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (screenVid.videoWidth && canvas.width !== screenVid.videoWidth) {
      canvas.width = screenVid.videoWidth;
      canvas.height = screenVid.videoHeight;
    }

    ctx.drawImage(screenVid, 0, 0, canvas.width, canvas.height);

    const cameraVid = cameraVideoRef.current;
    if (cameraVid && cameraActive && cameraVid.readyState >= 2) {
      const size = Math.min(canvas.width * 0.18, 220);
      const margin = 20;
      const x = canvas.width - size - margin;
      const y = canvas.height - size - margin;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(cameraVid, x, y, size, size);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [cameraActive]);

  const startDrawLoop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    drawFrame();
  }, [drawFrame]);

  const startCapture = useCallback(async (withCamera: boolean) => {
    setError(null);
    setState('requesting');
    try {
      const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
      screenStreamRef.current = screenStream;

      const screenVid = document.createElement('video');
      screenVid.srcObject = screenStream;
      screenVid.muted = true;
      screenVid.autoplay = true;
      await screenVid.play();
      screenVideoRef.current = screenVid;

      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      canvasRef.current = canvas;

      if (withCamera) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          cameraStreamRef.current = camStream;
          const camVid = document.createElement('video');
          camVid.srcObject = camStream;
          camVid.muted = true;
          camVid.autoplay = true;
          await camVid.play();
          cameraVideoRef.current = camVid;
          setCameraActive(true);
        } catch {
          setCameraActive(false);
        }
      }

      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopAll();
      });

      // Canvas video stream
      const canvasStream = canvas.captureStream(30);

      // Add system audio directly (simplest approach, works in Chrome)
      screenStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
        canvasStream.addTrack(track);
      });

      canvasStreamRef.current = canvasStream;
      setState('previewing');
      startDrawLoop();

    } catch (err: any) {
      console.error('Screen capture error:', err);
      setError('Não foi possível iniciar a captura de tela. Verifique as permissões.');
      setState('idle');
    }
  }, [startDrawLoop]);

  const toggleCamera = useCallback(async () => {
    if (cameraActive) {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
        cameraVideoRef.current = null;
      }
      setCameraActive(false);
    } else {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = camStream;
        const camVid = document.createElement('video');
        camVid.srcObject = camStream;
        camVid.muted = true;
        camVid.autoplay = true;
        await camVid.play();
        cameraVideoRef.current = camVid;
        setCameraActive(true);
      } catch {
        setError('Não foi possível acessar a câmera.');
      }
    }
  }, [cameraActive]);

  // Mic toggle: request mic once, then mute/unmute via gain node
  const toggleMic = useCallback(async () => {
    const canvas = canvasStreamRef.current;
    if (!canvas) return;

    if (micActive) {
      // Mute via gain
      if (micGainRef.current && audioCtxRef.current) {
        micGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      }
      setMicActive(false);
    } else {
      // First time: request mic and wire it through AudioContext into the canvas stream
      if (!micStreamRef.current) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micStreamRef.current = micStream;

          const audioCtx = new AudioContext();
          audioCtxRef.current = audioCtx;

          const destination = audioCtx.createMediaStreamDestination();
          const micSource = audioCtx.createMediaStreamSource(micStream);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 1;

          micSource.connect(gainNode);
          gainNode.connect(destination);
          micGainRef.current = gainNode;

          // Add the mixed mic audio track to the canvas stream for recording
          destination.stream.getAudioTracks().forEach(t => canvas.addTrack(t));
        } catch {
          setError('Não foi possível acessar o microfone.');
          return;
        }
      } else {
        // Re-enable
        if (micGainRef.current && audioCtxRef.current) {
          micGainRef.current.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
        }
      }
      setMicActive(true);
    }
  }, [micActive]);

  const start = useCallback(() => {
    if (!canvasStreamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    chunksRef.current = [];
    const recorder = new MediaRecorder(canvasStreamRef.current, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopTimer();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setPreviewUrl(url);
      setState('stopped');
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setState('recording');
    startTimer();
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      stopTimer();
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      startTimer();
    }
  }, []);

  const stop = useCallback(() => {
    // Stop recorder first (triggers onstop which will show the blob)
    if (mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
    // Stop source tracks (but NOT canvasStream — it needs to stay alive until onstop fires)
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const stopAll = useCallback(() => {
    if (mediaRecorderRef.current &&
      (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
    micStreamRef.current = null;
    canvasStreamRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    micGainRef.current = null;
    setCameraActive(false);
    setMicActive(false);
    stopTimer();
  }, []);

  const reset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setVideoBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setError(null);
    stopAll();
    setState('idle');
  }, [previewUrl, stopAll]);

  useEffect(() => {
    if (state === 'previewing' || state === 'recording' || state === 'paused') {
      startDrawLoop();
    }
  }, [cameraActive, state, startDrawLoop]);

  useEffect(() => {
    return () => {
      stopAll();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []); // eslint-disable-line

  return {
    state,
    videoBlob,
    previewUrl,
    duration,
    cameraActive,
    micActive,
    error,
    startCapture,
    toggleCamera,
    toggleMic,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
