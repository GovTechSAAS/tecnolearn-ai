"use client";

import { useState, useCallback, useEffect } from 'react';
import * as faceapiHelpers from '@/lib/faceapi';

export function useFaceApi() {
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    faceapiHelpers.loadModels().then(() => {
      if(mounted) setModelsLoaded(true);
    }).catch(err => console.error("Face API models failed to load", err));
    return () => { mounted = false; };
  }, []);

  const getDescriptor = useCallback(async (element: HTMLVideoElement | HTMLImageElement) => {
    return faceapiHelpers.getDescriptor(element);
  }, []);

  const compareFaces = useCallback((d1: Float32Array, d2: Float32Array) => {
    return faceapiHelpers.compareFaces(d1, d2);
  }, []);

  return { modelsLoaded, getDescriptor, compareFaces };
}
