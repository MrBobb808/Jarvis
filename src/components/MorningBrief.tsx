"use client";

import { Calendar, FileText, Mail, Play, RefreshCw } from "lucide-react";
import type { BriefData } from "@/lib/types";

interface Props {
  brief: BriefData | null;
  onPlay: () => void;
  onRefresh: () => void;
  onConnect: () => void;
  googleConnected: boolean;
  googleConfigured: boolean;
}

function timeOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // All-day events come through as a bare date.
  if (!iso.includes("T")) return "All day";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from.split("@")[0]).trim();
}

export function MorningBrief({
  brief,
  onPlay,
  onRefresh,
  onConnect,
  googleConnected,
  googleConfigured,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {brief?.greeting || "Daily Brief"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            {brief?.summary || "Gathering your day…"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconBtn label="Play brief" onClick={onPlay}>
            <Play size={16} />
          </IconBtn>
          <IconBtn label="Refresh" onClick={onRefresh}>
            <RefreshCw size={16} />
          </IconBtn>
        </div>
      </div>

      {!googleConnected && (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
          {googleConfigured ? (
            <button
              onClick={onConnect}
              className="font-medium text-cyan-200 underline-offset-2 hover:underline"
            >
              Connect your Google account →
            </button>
          ) : (
            <span>
              Set Google OAuth keys on the server to enable Gmail, Calendar, and
              Drive.
            </span>
          )}
        </div>
      )}

      {brief?.connected && (
        <>
          <Section icon={<Calendar size={14} />} title="Today">
            {brief.events.length === 0 && <Empty>Nothing scheduled.</Empty>}
            {brief.events.map((e) => (
              <Row key={e.id} primary={e.summary} meta={timeOf(e.start)} />
            ))}
          </Section>

          <Section icon={<Mail size={14} />} title="Inbox">
            {brief.emails.length === 0 && <Empty>Inbox is clear.</Empty>}
            {brief.emails.map((e) => (
              <Row
                key={e.id}
                primary={e.subject}
                secondary={senderName(e.from)}
                dot={e.unread}
              />
            ))}
          </Section>

          <Section icon={<FileText size={14} />} title="Recent files">
            {brief.files.length === 0 && <Empty>No recent files.</Empty>}
            {brief.files.map((f) => (
              <Row
                key={f.id}
                primary={f.name}
                href={f.webViewLink}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
    >
      {children}
    </button>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-300/70">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Row({
  primary,
  secondary,
  meta,
  dot,
  href,
}: {
  primary: string;
  secondary?: string;
  meta?: string;
  dot?: boolean;
  href?: string;
}) {
  const body = (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-800/50">
      {dot !== undefined && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot ? "bg-cyan-400" : "bg-slate-600"}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">{primary}</p>
        {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
      </div>
      {meta && <span className="shrink-0 text-xs text-slate-400">{meta}</span>}
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    body
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 text-xs text-slate-500">{children}</p>;
}
