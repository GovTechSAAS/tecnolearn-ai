"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from '@/hooks/useFaceApi';
import { Camera, AlertTriangle, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FaceCameraProps = {
  overlayMode: 'attendance' | 'security' | 'enroll';
  onDetect?: (descriptor: Float32Array, detectionTarget: faceapi.FaceDetection) => void;
  isProcessing?: boolean;
};

export default function FaceCamera({ overlayMode, onDetect, isProcessing = false }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMounted = useRef(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const { modelsLoaded, modelsLoading, modelsError, reloadModels } = useFaceApi();

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Permissão da câmera negada ou dispositivo não encontrado.");
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current || !stream) return;

    let animationFrameId: number;

    const detectLoop = async () => {
      if (!isMounted.current) return;
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4 && !isProcessing) {
        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptor();
        
        // RE-CHECK refs after async operation!
        if (!videoRef.current || !canvasRef.current || isProcessing) return;

        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);

        if (detection) {
          const resizedDetections = faceapi.resizeResults(detection, displaySize);
          
          // Clear canvas completely
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          let boxColor = 'rgba(255, 255, 255, 0.8)';
          if (overlayMode === 'attendance') boxColor = 'rgba(34, 197, 94, 0.8)'; // green
          if (overlayMode === 'security') boxColor = 'rgba(239, 68, 68, 0.8)'; // red
          if (overlayMode === 'enroll') boxColor = 'rgba(99, 102, 241, 0.8)'; // var(--primary)
          
          const box = resizedDetections.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, { label: overlayMode.toUpperCase(), boxColor, lineWidth: 3 });
          drawBox.draw(canvasRef.current);

          if (onDetect) {
            onDetect(detection.descriptor, detection.detection);
          }
        } else {
          // Limpa se não achar ninguém
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }

      if (isMounted.current) {
        animationFrameId = requestAnimationFrame(detectLoop);
      }
    };

    videoRef.current.addEventListener('play', () => {
      detectLoop();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [modelsLoaded, stream, overlayMode, onDetect, isProcessing]);

  return (
    <div className="relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 flex items-center justify-center">
      {!stream && !error && (
         <div className="text-center text-zinc-400 p-6">
           <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
           <p className="mb-4 text-sm font-medium">Acesso à câmera necessário para o módulo de {overlayMode}</p>
           <Button onClick={startCamera} className="bg-[var(--accent)] hover:bg-[#D35400] text-white">
             Ativar Câmera
           </Button>
         </div>
      )}
      
      {error && (
         <div className="text-center text-red-400 p-6 flex flex-col items-center">
           <AlertTriangle className="w-12 h-12 mb-2" />
           <p>{error}</p>
         </div>
      )}

      {modelsLoading && stream && (
         <div className="absolute inset-0 z-20 bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
           <div className="w-10 h-10 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin mb-4"></div>
           <p className="font-medium animate-pulse">Carregando IA Neural de Reconhecimento...</p>
         </div>
      )}

      {!modelsLoading && modelsError && stream && (
        <div className="absolute inset-0 z-20 bg-zinc-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
          <p className="font-semibold mb-2">Falha ao carregar IA Neural</p>
          <p className="text-sm text-zinc-300 max-w-md mb-4">
            Verifique se os modelos existem em `public/models` e tente novamente.
          </p>
          <Button onClick={reloadModels} className="bg-[var(--accent)] hover:bg-[#D35400] text-white">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Renderiza Câmera */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover transform -scale-x-100 ${!stream ? 'hidden' : ''}`}
      />
      
      {/* Canvas sobreposto para boxes do face-api */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none" 
      />

      {/* Overlay decorators depending on mode */}
      {stream && modelsLoaded && overlayMode === 'security' && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-100 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md animate-pulse">
           <AlertTriangle className="w-4 h-4" /> MONITORAMENTO DE SEGURANÇA ATIVO
        </div>
      )}

      {stream && modelsLoaded && overlayMode === 'attendance' && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-100 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-md">
           <UserCheck className="w-4 h-4" /> CHAMADA VIRTUAL AUTOMÁTICA
        </div>
      )}
    </div>
  );
}
