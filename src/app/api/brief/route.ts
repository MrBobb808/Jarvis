import { getAnthropic, MODEL } from "@/lib/anthropic";
import {
  getAuthedClient,
  getUserProfile,
  listCalendarEvents,
  listRecentEmails,
  searchDrive,
} from "@/lib/google";
import type { BriefData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function greetingFor(name?: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const who = name ? `, ${name.split(" ")[0]}` : "";
  return `${part}${who}.`;
}

export async function GET() {
  const auth = await getAuthedClient();
  const greeting = greetingFor();

  if (!auth) {
    const data: BriefData = {
      greeting,
      generatedAt: new Date().toISOString(),
      summary:
        "I'm online. Connect your Google account and I'll pull your inbox, calendar, and Drive into a morning brief.",
      emails: [],
      events: [],
      files: [],
      connected: false,
    };
    return Response.json(data);
  }

  const [profile, emails, events, files] = await Promise.all([
    getUserProfile(auth),
    listRecentEmails(auth, { query: "in:inbox newer_than:2d", max: 6 }).catch(() => []),
    listCalendarEvents(auth, { max: 8 }).catch(() => []),
    searchDrive(auth, { max: 5 }).catch(() => []),
  ]);

  let summary = "";
  const client = getAnthropic();
  if (client) {
    try {
      const facts = JSON.stringify({
        now: new Date().toString(),
        emails: emails.map((e) => ({ from: e.from, subject: e.subject, unread: e.unread })),
        events: events.map((e) => ({ summary: e.summary, start: e.start })),
        recentFiles: files.map((f) => f.name),
      });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 350,
        system:
          "You are JARVIS giving a spoken morning brief. Write 3-5 natural sentences, no markdown, no lists. Lead with the schedule and anything time-sensitive, then notable emails. Be warm and concise. Do not invent anything not in the data.",
        messages: [{ role: "user", content: `Here is the data:\n${facts}\n\nGive the brief.` }],
      });
      summary = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join(" ")
        .trim();
    } catch {
      summary = "";
    }
  }

  if (!summary) {
    const unread = emails.filter((e) => e.unread).length;
    summary =
      `You have ${events.length} event${events.length === 1 ? "" : "s"} today and ` +
      `${unread} unread message${unread === 1 ? "" : "s"} in the last couple of days.`;
  }

  const data: BriefData = {
    greeting: greetingFor(profile.name),
    generatedAt: new Date().toISOString(),
    summary,
    emails,
    events,
    files,
    connected: true,
  };
  return Response.json(data);
}
