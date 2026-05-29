"use client";

import { useEffect, useState } from "react";
import {
  Mic,
  Plug,
  Repeat,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { VoiceOrb } from "@/components/VoiceOrb";
import { ChatLog } from "@/components/ChatLog";
import { MorningBrief } from "@/components/MorningBrief";
import { useJarvis } from "@/hooks/useJarvis";
import type { JarvisState } from "@/lib/types";

const STATE_LABEL: Record<JarvisState, string> = {
  idle: "Tap the orb and speak",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Connection issue",
};

export default function Home() {
  const j = useJarvis();
  const [input, setInput] = useState("");
  const [banner, setBanner] = useState("");

  // Handle the OAuth redirect result, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setBanner("Google connected.");
      j.refreshGoogle();
      j.refreshBrief();
    } else if (params.get("error")) {
      setBanner(`Connection failed: ${params.get("error")}`);
    }
    if (params.toString()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("connected") || params.get("error")) {
      const t = setTimeout(() => setBanner(""), 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    j.sendText(input);
    setInput("");
  };

  const label =
    j.state === "thinking" && j.status ? j.status : STATE_LABEL[j.state];

  return (
    <main className="mx-auto flex h-screen w-full max-w-7xl flex-col px-4 py-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-[0.3em] text-cyan-300">
            JARVIS
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            personal assistant
          </span>
        </div>

        <div className="flex items-center gap-2">
          <GoogleChip
            configured={j.google.configured}
            connected={j.google.connected}
            email={j.google.email}
            onConnect={j.connectGoogle}
            onDisconnect={j.disconnectGoogle}
          />
          <Toggle
            active={j.autoListen}
            onClick={() => j.setAutoListen((v) => !v)}
            title="Auto-listen after replies"
          >
            <Repeat size={16} />
          </Toggle>
          <Toggle active={!j.muted} onClick={j.toggleMute} title="Voice output">
            {j.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Toggle>
        </div>
      </header>

      {banner && (
        <div className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          {banner}
        </div>
      )}

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <section className="flex min-h-0 flex-col">
          <div className="flex flex-col items-center pt-2">
            <VoiceOrb
              state={j.state}
              level={j.level}
              onClick={j.toggleListening}
              size={260}
            />
            <p className="mt-3 h-5 text-sm text-slate-400">{label}</p>
            {j.interim && (
              <p className="mt-1 max-w-md text-center text-sm italic text-slate-500">
                {j.interim}
              </p>
            )}
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/30">
            <ChatLog messages={j.messages} streaming={j.streaming} interim="" />
          </div>

          <form onSubmit={submit} className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={j.toggleListening}
              disabled={!j.voiceSupported}
              aria-label="Toggle microphone"
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
                j.state === "listening"
                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-700/60 bg-slate-800/60 text-slate-300 hover:text-cyan-200",
                !j.voiceSupported ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              <Mic size={18} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Jarvis…"
              className="h-11 flex-1 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            />
            <button
              type="submit"
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/90 text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
              disabled={!input.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </section>

        {/* Brief sidebar */}
        <aside className="min-h-0">
          <MorningBrief
            brief={j.brief}
            onPlay={j.speakBrief}
            onRefresh={j.refreshBrief}
            onConnect={j.connectGoogle}
            googleConnected={j.google.connected}
            googleConfigured={j.google.configured}
          />
        </aside>
      </div>
    </main>
  );
}

function Toggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-lg border transition",
        active
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
          : "border-slate-700/60 bg-slate-800/50 text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GoogleChip({
  configured,
  connected,
  email,
  onConnect,
  onDisconnect,
}: {
  configured: boolean;
  connected: boolean;
  email?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (connected) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 py-1 pl-2.5 pr-1 text-xs text-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="max-w-[140px] truncate">{email || "Google"}</span>
        <button
          onClick={onDisconnect}
          aria-label="Disconnect Google"
          className="rounded p-1 hover:bg-emerald-500/20"
        >
          <X size={12} />
        </button>
      </div>
    );
  }
  if (!configured) {
    return (
      <span className="hidden rounded-lg border border-slate-700/60 px-2.5 py-1.5 text-xs text-slate-500 sm:inline">
        Google not set up
      </span>
    );
  }
  return (
    <button
      onClick={onConnect}
      className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20"
    >
      <Plug size={13} />
      Connect Google
    </button>
  );
}
