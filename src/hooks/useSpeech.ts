"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeakOpts {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Text-to-speech that prefers ElevenLabs (natural voice, served via /api/tts)
 * and transparently falls back to the browser's SpeechSynthesis API.
 */
export function useSpeech() {
  const [browserSupported, setBrowserSupported] = useState(false);
  const [elevenAvailable, setElevenAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const elevenRef = useRef(false);

  // Detect browser voices.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setBrowserSupported(true);
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      voiceRef.current =
        voices.find((v) => /Google UK English Male/i.test(v.name)) ||
        voices.find((v) => /en[-_]GB/i.test(v.lang) && /Daniel/i.test(v.name)) ||
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

  // Detect ElevenLabs availability on the server.
  useEffect(() => {
    let active = true;
    fetch("/api/tts")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (!active) return;
        elevenRef.current = Boolean(d.configured);
        setElevenAvailable(Boolean(d.configured));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback((text: string, opts?: SpeakOpts) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      opts?.onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utter.voice = voiceRef.current;
    utter.rate = 1.02;
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
  }, []);

  const speak = useCallback(
    async (text: string, opts?: SpeakOpts) => {
      if (!text) {
        opts?.onEnd?.();
        return;
      }
      cancel();

      if (elevenRef.current) {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) throw new Error("tts failed");
          const buf = await res.arrayBuffer();
          const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onplay = () => {
            setSpeaking(true);
            opts?.onStart?.();
          };
          const finish = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
            opts?.onEnd?.();
          };
          audio.onended = finish;
          audio.onerror = finish;
          await audio.play();
          return;
        } catch {
          // Network/quota issue — fall back to the browser voice.
        }
      }

      speakBrowser(text, opts);
    },
    [cancel, speakBrowser],
  );

  return {
    supported: browserSupported || elevenAvailable,
    elevenAvailable,
    speaking,
    speak,
    cancel,
  };
}
