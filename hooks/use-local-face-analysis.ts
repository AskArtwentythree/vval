'use client';

import { useEffect, useState } from 'react';

import {
  analyzeLiveFace,
  getHuman,
  type LiveFaceEvidence,
} from '@/lib/local-verification';

export function useLocalFaceAnalysis({
  active,
  videoRef,
  documentEmbedding,
}: {
  active: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  documentEmbedding?: number[];
}) {
  const [evidence, setEvidence] = useState<LiveFaceEvidence | null>(null);
  const [modelStatus, setModelStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;

    const run = async () => {
      const video = videoRef.current;
      if (
        cancelled ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        timer = window.setTimeout(run, 250);
        return;
      }

      try {
        const nextEvidence = await analyzeLiveFace(video, documentEmbedding);
        if (cancelled) return;
        failures = 0;
        setEvidence(nextEvidence);
        setModelStatus('ready');
        setError('');
      } catch (analysisError) {
        if (cancelled) return;
        failures += 1;
        if (failures >= 3) {
          setModelStatus('error');
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : 'Face analysis is unavailable in this browser.',
          );
        }
      }
      if (!cancelled) timer = window.setTimeout(run, 450);
    };

    queueMicrotask(() => {
      if (!cancelled) {
        setModelStatus('loading');
        setError('');
      }
    });
    void getHuman()
      .then(() => {
        if (!cancelled) void run();
      })
      .catch((loadError) => {
        if (cancelled) return;
        setModelStatus('error');
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Face models could not be loaded.',
        );
      });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [active, documentEmbedding, videoRef]);

  return { evidence, modelStatus, error };
}
