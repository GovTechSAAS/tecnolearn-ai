import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

export async function loadModels() {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
}

export async function getDescriptor(imageElement: HTMLVideoElement | HTMLImageElement) {
  const detection = await faceapi
    .detectSingleFace(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export function compareFaces(d1: Float32Array, d2: Float32Array): boolean {
  const distance = faceapi.euclideanDistance(d1, d2);
  // Threshold 0.6 is common for face-api.js models to determine a match
  return distance < 0.6;
}
