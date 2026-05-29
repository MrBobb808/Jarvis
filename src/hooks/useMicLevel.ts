"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a smoothed microphone loudness level (0..1) while `active`.
 * Used to make the voice orb react to the user's speech.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function begin() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel((prev) => prev * 0.7 + Math.min(1, rms * 3) * 0.3);
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        /* mic denied — orb falls back to idle animation */
      }
    }

    function end() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      setLevel(0);
    }

    if (active) begin();
    else end();

    return () => {
      cancelled = true;
      end();
    };
  }, [active]);

  return level;
}
