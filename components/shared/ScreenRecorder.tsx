"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Camera, CameraOff, Play, Pause, Square, RotateCcw, CheckCircle2, Loader2, Mic, MicOff } from 'lucide-react';
import { useScreenRecorder } from '@/hooks/useScreenRecorder';

interface ScreenRecorderProps {
  onVideoReady: (blob: Blob) => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ScreenRecorder({ onVideoReady }: ScreenRecorderProps) {
  const [videoAttached, setVideoAttached] = useState(false);

  const {
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
  } = useScreenRecorder();

  const handleUseVideo = () => {
    if (videoBlob) {
      onVideoReady(videoBlob);
      setVideoAttached(true);
    }
  };

  const handleReset = () => {
    setVideoAttached(false);
    reset();
  };

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 text-sm">
          {error}
        </div>
      )}

      {/* IDLE */}
      {state === 'idle' && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-border rounded-xl bg-zinc-50 dark:bg-zinc-900/40 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-[var(--primary)]" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Gravação de Tela</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              O áudio do computador será capturado. Você pode habilitar câmera e microfone após iniciar.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={() => startCapture(false)} className="bg-[var(--primary)] text-white hover:bg-[#A93226]">
              <Monitor className="w-4 h-4 mr-2" />
              Gravar Tela
            </Button>
            <Button onClick={() => startCapture(true)} variant="outline">
              <Camera className="w-4 h-4 mr-2" />
              Gravar com Câmera
            </Button>
          </div>
        </div>
      )}

      {/* REQUESTING */}
      {state === 'requesting' && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 border border-dashed border-border rounded-xl bg-zinc-50 dark:bg-zinc-900/40">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          <p className="text-sm text-muted-foreground">Aguardando permissão de captura de tela...</p>
        </div>
      )}

      {/* PREVIEWING / RECORDING / PAUSED */}
      {(state === 'previewing' || state === 'recording' || state === 'paused') && (
        <div className="space-y-3">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-zinc-900 text-white rounded-t-xl px-4 py-2">
            <div className="flex items-center gap-2">
              {state === 'recording' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-mono font-bold text-red-400">REC</span>
                </>
              ) : state === 'paused' ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-sm font-mono font-bold text-amber-300">PAUSADO</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                  <span className="text-sm font-mono text-zinc-400">PRONTO</span>
                </>
              )}
              <span className="text-sm font-mono text-zinc-300 ml-2">{formatDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase">
              <span className={cameraActive ? 'text-emerald-400' : 'text-zinc-500'}>📷 {cameraActive ? 'ON' : 'OFF'}</span>
              <span className={micActive ? 'text-blue-400' : 'text-zinc-500'}>🎙️ {micActive ? 'ON' : 'OFF'}</span>
            </div>
          </div>

          {/* Preview placeholder */}
          <div className="relative bg-zinc-950 rounded-b-xl overflow-hidden aspect-video w-full flex items-center justify-center">
            <div className="text-zinc-500 text-sm text-center p-8">
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
              {state === 'previewing' ? (
                <p>Clique em <strong className="text-zinc-300">Iniciar Gravação</strong> quando estiver pronto.</p>
              ) : state === 'recording' ? (
                <p className="text-red-400 font-semibold">● Gravando... tela + câmera sendo capturadas.</p>
              ) : (
                <p className="text-amber-400">Gravação pausada.</p>
              )}
              {cameraActive && (
                <div className="absolute bottom-4 right-4 w-20 h-20 rounded-full border-2 border-white/70 bg-zinc-800 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-zinc-400" />
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {state === 'previewing' && (
              <Button onClick={start} className="bg-red-600 hover:bg-red-700 text-white">
                <Play className="w-4 h-4 mr-2" /> Iniciar Gravação
              </Button>
            )}
            {state === 'recording' && (
              <>
                <Button onClick={pause} variant="outline">
                  <Pause className="w-4 h-4 mr-2" /> Pausar
                </Button>
                <Button onClick={stop} variant="destructive">
                  <Square className="w-4 h-4 mr-2" /> Parar
                </Button>
              </>
            )}
            {state === 'paused' && (
              <>
                <Button onClick={resume} className="bg-[var(--primary)] text-white">
                  <Play className="w-4 h-4 mr-2" /> Retomar
                </Button>
                <Button onClick={stop} variant="destructive">
                  <Square className="w-4 h-4 mr-2" /> Finalizar
                </Button>
              </>
            )}

            <Button onClick={toggleCamera} variant="outline" className={cameraActive ? 'border-[var(--primary)] text-[var(--primary)]' : ''}>
              {cameraActive ? <CameraOff className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              {cameraActive ? 'Desligar Câmera' : 'Câmera'}
            </Button>

            <Button onClick={toggleMic} variant="outline" className={micActive ? 'border-blue-500 text-blue-600 dark:text-blue-400' : ''}>
              {micActive ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
              {micActive ? 'Desligar Mic' : 'Microfone'}
            </Button>

            <Button onClick={handleReset} variant="ghost" className="text-zinc-500 ml-auto">
              <RotateCcw className="w-4 h-4 mr-2" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* STOPPED: Preview + confirm */}
      {state === 'stopped' && previewUrl && (
        <div className="space-y-4">
          {videoAttached ? (
            /* Success state after "Usar Este Vídeo" */
            <div className="flex flex-col items-center gap-4 p-8 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">Vídeo anexado com sucesso!</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                  Clique em <strong>Salvar Conteúdo</strong> para enviar.
                </p>
              </div>
              <Button onClick={handleReset} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" /> Gravar outro vídeo
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl overflow-hidden bg-zinc-950 border border-border">
                {/* Use key=previewUrl to force remount when url changes */}
                <video
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  autoPlay={false}
                  className="w-full max-h-80 object-contain"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleUseVideo} className="bg-[var(--primary)] text-white hover:bg-[#A93226] flex-1">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Usar Este Vídeo
                </Button>
                <Button onClick={handleReset} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Regravar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
