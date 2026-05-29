"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Text-to-speech via the browser's SpeechSynthesis API. */
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setSupported(true);

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // Prefer a natural-sounding English voice.
      voiceRef.current =
        voices.find((v) => /en[-_]GB/i.test(v.lang) && /Daniel|Google/i.test(v.name)) ||
        voices.find((v) => /Google UK English Male/i.test(v.name)) ||
        voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
    };

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, opts?: { onStart?: () => void; onEnd?: () => void }) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.onstart = () => {
        setSpeaking(true);
        opts?.onStart?.();
      };
      utter.onend = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      utter.onerror = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      window.speechSynthesis.speak(utter);
    },
    [],
  );

  return { supported, speaking, speak, cancel };
}
