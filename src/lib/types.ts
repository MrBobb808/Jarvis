// Shared types across the Jarvis app.

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

/** High-level state of the assistant, drives the orb animation. */
export type JarvisState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

/** Server-sent event payloads streamed from /api/chat. */
export type ChatStreamEvent =
  | { type: "status"; text: string }
  | { type: "token"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; text: string };

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  hangoutLink?: string;
}

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface BriefData {
  greeting: string;
  generatedAt: string;
  summary: string;
  emails: EmailSummary[];
  events: CalendarEventSummary[];
  files: DriveFileSummary[];
  connected: boolean;
}
