import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { getStoredTokens } from "./tokens";
import type {
  CalendarEventSummary,
  DriveFileSummary,
  EmailSummary,
} from "./types";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function getOAuthClient(redirectUri?: string): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri ||
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:3000/api/auth/google/callback",
  );
}

export function getAuthUrl(redirectUri?: string): string {
  return getOAuthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
}

export async function exchangeCode(code: string, redirectUri?: string) {
  const client = getOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

/** Build an OAuth client primed with the user's stored credentials, or null. */
export async function getAuthedClient(): Promise<OAuth2Client | null> {
  if (!googleConfigured()) return null;
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  const client = getOAuthClient();
  client.setCredentials(tokens);
  return client;
}

export async function isConnected(): Promise<boolean> {
  return (await getAuthedClient()) !== null;
}

export async function getUserProfile(
  auth: OAuth2Client,
): Promise<{ email?: string; name?: string }> {
  try {
    const oauth2 = google.oauth2({ version: "v2", auth });
    const { data } = await oauth2.userinfo.get();
    return { email: data.email || undefined, name: data.name || undefined };
  } catch {
    return {};
  }
}

function header(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

export async function listRecentEmails(
  auth: OAuth2Client,
  opts: { query?: string; max?: number } = {},
): Promise<EmailSummary[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: opts.max ?? 8,
    q: opts.query || "in:inbox",
  });
  const ids = list.data.messages?.map((m) => m.id!).filter(Boolean) ?? [];
  const messages = await Promise.all(
    ids.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      }),
    ),
  );
  return messages.map((m) => {
    const headers = m.data.payload?.headers ?? undefined;
    return {
      id: m.data.id!,
      from: header(headers, "From"),
      subject: header(headers, "Subject") || "(no subject)",
      snippet: m.data.snippet || "",
      date: header(headers, "Date"),
      unread: m.data.labelIds?.includes("UNREAD") ?? false,
    };
  });
}

export async function listCalendarEvents(
  auth: OAuth2Client,
  opts: { timeMin?: string; timeMax?: string; max?: number } = {},
): Promise<CalendarEventSummary[]> {
  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: opts.timeMin || now.toISOString(),
    timeMax: opts.timeMax || endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: opts.max ?? 10,
  });
  return (data.items ?? []).map((e) => ({
    id: e.id!,
    summary: e.summary || "(no title)",
    start: e.start?.dateTime || e.start?.date || "",
    end: e.end?.dateTime || e.end?.date || "",
    location: e.location || undefined,
    hangoutLink: e.hangoutLink || undefined,
  }));
}

export async function searchDrive(
  auth: OAuth2Client,
  opts: { query?: string; max?: number } = {},
): Promise<DriveFileSummary[]> {
  const drive = google.drive({ version: "v3", auth });
  const q = opts.query
    ? `name contains '${opts.query.replace(/'/g, "\\'")}' and trashed = false`
    : "trashed = false";
  const { data } = await drive.files.list({
    q,
    pageSize: opts.max ?? 8,
    orderBy: "modifiedTime desc",
    fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
  });
  return (data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name || "(untitled)",
    mimeType: f.mimeType || "",
    modifiedTime: f.modifiedTime || "",
    webViewLink: f.webViewLink || undefined,
  }));
}
