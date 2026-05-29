import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import { TOOL_DEFS, executeTool } from "@/lib/tools";
import type { ChatMessage, ChatStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TURNS = 6;

const STATUS_FOR_TOOL: Record<string, string> = {
  get_recent_emails: "Checking your inbox…",
  get_calendar_events: "Looking at your calendar…",
  search_drive: "Searching your Drive…",
  get_current_datetime: "One moment…",
};

export async function POST(req: Request) {
  const client = getAnthropic();
  if (!client) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  const messages: Anthropic.MessageParam[] = (body.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Cache the static system prompt + tool schema across turns.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  const tools: Anthropic.Tool[] = TOOL_DEFS.map((t, i) =>
    i === TOOL_DEFS.length - 1
      ? { ...t, cache_control: { type: "ephemeral" } }
      : t,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      let finalText = "";
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const ms = client.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system,
            tools,
            messages,
          });

          ms.on("text", (delta) => {
            finalText += delta;
            send({ type: "token", text: delta });
          });

          const msg = await ms.finalMessage();

          if (msg.stop_reason !== "tool_use") {
            break;
          }

          // Run every requested tool, feed results back, loop.
          messages.push({ role: "assistant", content: msg.content });
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of msg.content) {
            if (block.type !== "tool_use") continue;
            send({
              type: "status",
              text: STATUS_FOR_TOOL[block.name] || "Working on it…",
            });
            const result = await executeTool(
              block.name,
              (block.input as Record<string, unknown>) || {},
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
          messages.push({ role: "user", content: toolResults });
        }

        send({ type: "done", text: finalText.trim() });
      } catch (err) {
        send({ type: "error", text: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
