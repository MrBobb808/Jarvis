"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  onFinal: (text: string) => void;
  lang?: string;
}

/**
 * Push-to-talk speech recognition via the Web Speech API.
 * Accumulates a final transcript and fires `onFinal` when listening ends.
 */
export function useSpeechRecognition({ onFinal, lang = "en-US" }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalRef.current += text + " ";
        else interimText += text;
      }
      setInterim(interimText);
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      finalRef.current = "";
      if (text) onFinalRef.current(text);
    };

    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || listening) return;
    finalRef.current = "";
    setInterim("");
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}
