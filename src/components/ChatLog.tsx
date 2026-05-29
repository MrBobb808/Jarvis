"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

interface Props {
  messages: ChatMessage[];
  streaming: string;
  interim: string;
}

export function ChatLog({ messages, streaming, interim }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, interim]);

  const empty = messages.length === 0 && !streaming && !interim;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-1 py-2">
      {empty && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Tap the orb and speak, or type below.
        </p>
      )}

      {messages.map((m, i) => (
        <Bubble key={i} role={m.role} text={m.content} />
      ))}

      {streaming && <Bubble role="assistant" text={streaming} pending />}
      {interim && <Bubble role="user" text={interim} pending />}

      <div ref={endRef} />
    </div>
  );
}

function Bubble({
  role,
  text,
  pending,
}: {
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-slate-700/60 text-slate-100"
            : "bg-cyan-500/10 text-cyan-50 ring-1 ring-cyan-400/20",
          pending ? "opacity-70" : "",
        ].join(" ")}
      >
        {!isUser && (
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-cyan-300/70">
            Jarvis
          </span>
        )}
        {text}
        {pending && <span className="ml-1 animate-pulse">▍</span>}
      </div>
    </div>
  );
}
