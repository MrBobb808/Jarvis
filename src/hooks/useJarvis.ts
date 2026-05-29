"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BriefData,
  ChatMessage,
  ChatStreamEvent,
  JarvisState,
} from "@/lib/types";
import { useMicLevel } from "./useMicLevel";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useSpeechSynthesis } from "./useSpeechSynthesis";

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
}

const HISTORY_LIMIT = 16;

export function useJarvis() {
  const [state, setState] = useState<JarvisState>("idle");
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [muted, setMuted] = useState(false);
  const [autoListen, setAutoListen] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [google, setGoogle] = useState<GoogleStatus>({
    configured: false,
    connected: false,
  });

  const tts = useSpeechSynthesis();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const autoListenRef = useRef(autoListen);
  autoListenRef.current = autoListen;
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Forward declaration so recognition's onFinal can reach sendText.
  const sendTextRef = useRef<(t: string) => void>(() => {});

  const recog = useSpeechRecognition({
    onFinal: (text) => sendTextRef.current(text),
  });

  const micLevel = useMicLevel(state === "listening");

  const speakReply = useCallback(
    (text: string) => {
      if (mutedRef.current || !tts.supported) {
        setState("idle");
        if (autoListenRef.current) setTimeout(() => recog.start(), 300);
        return;
      }
      setState("speaking");
      tts.speak(text, {
        onEnd: () => {
          setState("idle");
          if (autoListenRef.current) setTimeout(() => recog.start(), 400);
        },
      });
    },
    [tts, recog],
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      tts.cancel();

      const history = [...messagesRef.current, { role: "user", content: trimmed } as ChatMessage];
      setMessages(history);
      setStreaming("");
      setStatus("");
      setState("thinking");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.slice(-HISTORY_LIMIT) }),
        });

        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? "My language core is offline — the server is missing its API key."
              : "Something went wrong reaching my core.";
          setMessages((m) => [...m, { role: "assistant", content: msg }]);
          setState("error");
          setTimeout(() => setState("idle"), 1500);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const evt = JSON.parse(line.slice(5).trim()) as ChatStreamEvent;
            if (evt.type === "status") {
              setStatus(evt.text);
            } else if (evt.type === "token") {
              full += evt.text;
              setStreaming(full);
            } else if (evt.type === "done") {
              full = evt.text || full;
            } else if (evt.type === "error") {
              full = `I hit a problem: ${evt.text}`;
            }
          }
        }

        setStatus("");
        setStreaming("");
        const reply = full.trim() || "I didn't catch that.";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        speakReply(reply);
      } catch {
        setStreaming("");
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "I lost the connection for a moment." },
        ]);
        setState("error");
        setTimeout(() => setState("idle"), 1500);
      }
    },
    [tts, speakReply],
  );

  sendTextRef.current = sendText;

  // Reflect recognition state into the orb.
  useEffect(() => {
    if (recog.listening) setState("listening");
    else setState((s) => (s === "listening" ? "idle" : s));
  }, [recog.listening]);

  const startListening = useCallback(() => {
    tts.cancel();
    recog.start();
  }, [recog, tts]);

  const stopListening = useCallback(() => recog.stop(), [recog]);

  const toggleListening = useCallback(() => {
    if (recog.listening) recog.stop();
    else startListening();
  }, [recog, startListening]);

  const refreshBrief = useCallback(async () => {
    try {
      const res = await fetch("/api/brief");
      const data = (await res.json()) as BriefData;
      setBrief(data);
    } catch {
      /* ignore */
    }
  }, []);

  const speakBrief = useCallback(() => {
    if (!brief) return;
    speakReply(`${brief.greeting} ${brief.summary}`);
  }, [brief, speakReply]);

  const refreshGoogle = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status");
      setGoogle((await res.json()) as GoogleStatus);
    } catch {
      /* ignore */
    }
  }, []);

  const connectGoogle = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const disconnectGoogle = useCallback(async () => {
    await fetch("/api/google/status", { method: "DELETE" });
    await refreshGoogle();
    await refreshBrief();
  }, [refreshGoogle, refreshBrief]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) tts.cancel();
      return !m;
    });
  }, [tts]);

  // Initial load.
  useEffect(() => {
    refreshGoogle();
    refreshBrief();
  }, [refreshGoogle, refreshBrief]);

  return {
    state,
    status,
    messages,
    streaming,
    interim: recog.interim,
    level: micLevel,
    muted,
    autoListen,
    setAutoListen,
    brief,
    google,
    voiceSupported: recog.supported,
    ttsSupported: tts.supported,
    sendText,
    startListening,
    stopListening,
    toggleListening,
    refreshBrief,
    refreshGoogle,
    speakBrief,
    connectGoogle,
    disconnectGoogle,
    toggleMute,
  };
}
