/**
 * Camera access. getUserMedia is called ONLY from an explicit user click
 * (start()), never on mount. All tracks are stopped on stop()/unmount/capture-leave.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'captured' | 'error';

export interface CameraErrorInfo {
  code: 'denied' | 'not-found' | 'not-supported' | 'generic';
  title: string;
  guidance: string;
}

function toCameraError(err: unknown): CameraErrorInfo {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return {
      code: 'denied',
      title: 'Camera access was denied',
      guidance:
        'Your browser blocked the camera. Click the camera/lock icon in the address bar, allow camera access for this site, then press Retry.',
    };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return {
      code: 'not-found',
      title: 'No camera found',
      guidance:
        'No camera device was detected. Connect a camera or use "Upload Room Photo" instead.',
    };
  }
  if (name === 'NotSupportedError' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    return {
      code: 'not-supported',
      title: 'Camera not supported',
      guidance:
        'This browser does not support camera capture (it needs a secure HTTPS context). Please use "Upload Room Photo" instead.',
    };
  }
  return {
    code: 'generic',
    title: 'Could not start the camera',
    guidance:
      err instanceof Error && err.message
        ? err.message
        : 'Something went wrong starting the camera. Press Retry or upload a photo instead.',
  };
}

export interface UseCamera {
  status: CameraStatus;
  error: CameraErrorInfo | null;
  facingMode: 'user' | 'environment';
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  /** Must be called from a user gesture. */
  start: () => Promise<void>;
  stop: () => void;
  retry: () => void;
  switchFacing: () => Promise<void>;
  capture: () => Promise<Blob>;
}

export function useCamera(): UseCamera {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraErrorInfo | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef(facingMode);
  facingRef.current = facingMode;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startWithFacing = useCallback(
    async (mode: 'user' | 'environment') => {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setError(toCameraError(new DOMException('unsupported', 'NotSupportedError')));
        setStatus('error');
        return;
      }
      setStatus('starting');
      setError(null);
      stopTracks();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stopTracks();
          throw new Error('Camera preview element is not ready.');
        }
        video.srcObject = stream;
        await video.play();
        setStatus('live');
      } catch (err) {
        stopTracks();
        setError(toCameraError(err));
        setStatus('error');
      }
    },
    [stopTracks],
  );

  const start = useCallback(async () => {
    await startWithFacing(facingRef.current);
  }, [startWithFacing]);

  const stop = useCallback(() => {
    stopTracks();
    setStatus('idle');
    setError(null);
  }, [stopTracks]);

  const retry = useCallback(() => {
    void start();
  }, [start]);

  const switchFacing = useCallback(async () => {
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    facingRef.current = next;
    await startWithFacing(next);
  }, [startWithFacing]);

  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) throw new Error('Camera is not ready to capture.');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) throw new Error('Capture failed.');
    setStatus('captured');
    return blob;
  }, []);

  // Stop all tracks on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { status, error, facingMode, videoRef, start, stop, retry, switchFacing, capture };
}
