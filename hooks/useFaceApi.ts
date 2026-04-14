"use client";

import { useState, useCallback, useEffect } from 'react';
import * as faceapiHelpers from '@/lib/faceapi';

export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const loadAllModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      await faceapiHelpers.loadModels();
      setModelsLoaded(true);
    } catch (err: any) {
      setModelsLoaded(false);
      setModelsError(err?.message || 'Falha ao carregar modelos de reconhecimento facial.');
      console.error("Face API models failed to load", err);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await faceapiHelpers.loadModels();
        if (!mounted) return;
        setModelsLoaded(true);
        setModelsError(null);
      } catch (err: any) {
        if (!mounted) return;
        setModelsLoaded(false);
        setModelsError(err?.message || 'Falha ao carregar modelos de reconhecimento facial.');
        console.error("Face API models failed to load", err);
      } finally {
        if (mounted) setModelsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getDescriptor = useCallback(async (element: HTMLVideoElement | HTMLImageElement) => {
    return faceapiHelpers.getDescriptor(element);
  }, []);

  const compareFaces = useCallback((d1: Float32Array, d2: Float32Array) => {
    return faceapiHelpers.compareFaces(d1, d2);
  }, []);

  return { modelsLoaded, modelsLoading, modelsError, reloadModels: loadAllModels, getDescriptor, compareFaces };
}
