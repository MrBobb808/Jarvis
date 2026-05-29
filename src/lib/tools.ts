import type OpenAI from "openai";
import {
  getAuthedClient,
  listCalendarEvents,
  listRecentEmails,
  searchDrive,
} from "./google";

/** Tool schema advertised to the model (OpenAI function-calling format). */
export const TOOL_DEFS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_recent_emails",
      description:
        "Read the user's recent Gmail messages. Use for questions about email, unread messages, or what's in the inbox.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Optional Gmail search query, e.g. 'is:unread', 'from:boss@x.com', 'newer_than:2d'. Defaults to the inbox.",
          },
          max: {
            type: "number",
            description: "Max messages to return (default 8, max 20).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description:
        "List events from the user's primary Google Calendar. Use for questions about the schedule, meetings, or what's coming up. Defaults to the rest of today.",
      parameters: {
        type: "object",
        properties: {
          timeMin: { type: "string", description: "ISO start time. Defaults to now." },
          timeMax: { type: "string", description: "ISO end time. Defaults to end of today." },
          max: { type: "number", description: "Max events (default 10)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_drive",
      description:
        "Search the user's Google Drive by file name. Use when the user asks to find a document, sheet, or file.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Text to match in the file name." },
          max: { type: "number", description: "Max files (default 8)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_datetime",
      description:
        "Get the current date and time. Use before reasoning about relative dates like 'today' or 'tomorrow'.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const NOT_CONNECTED =
  "Google is not connected. Tell the user to connect their Google account using the Connect button.";

/** Execute a tool call and return a string result for the model. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === "get_current_datetime") {
    return new Date().toString();
  }

  const auth = await getAuthedClient();
  if (!auth) return NOT_CONNECTED;

  try {
    switch (name) {
      case "get_recent_emails": {
        const emails = await listRecentEmails(auth, {
          query: input.query as string | undefined,
          max: Math.min((input.max as number) || 8, 20),
        });
        return emails.length
          ? JSON.stringify(emails)
          : "No matching emails found.";
      }
      case "get_calendar_events": {
        const events = await listCalendarEvents(auth, {
          timeMin: input.timeMin as string | undefined,
          timeMax: input.timeMax as string | undefined,
          max: (input.max as number) || 10,
        });
        return events.length
          ? JSON.stringify(events)
          : "No events found in that window.";
      }
      case "search_drive": {
        const files = await searchDrive(auth, {
          query: input.query as string | undefined,
          max: (input.max as number) || 8,
        });
        return files.length ? JSON.stringify(files) : "No matching files found.";
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Error running ${name}: ${(err as Error).message}`;
  }
}
