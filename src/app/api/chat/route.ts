import type OpenAI from "openai";
import { getOpenAI, MODEL, SYSTEM_PROMPT } from "@/lib/openai";
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

interface ToolAcc {
  id: string;
  name: string;
  args: string;
}

export async function POST(req: Request) {
  const client = getOpenAI();
  if (!client) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as { messages: ChatMessage[] };
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(body.messages || []).map((m) => ({ role: m.role, content: m.content })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      let finalText = "";
      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const completion = await client.chat.completions.create({
            model: MODEL,
            max_tokens: 1024,
            messages,
            tools: TOOL_DEFS,
            tool_choice: "auto",
            stream: true,
          });

          let content = "";
          const toolAcc: Record<number, ToolAcc> = {};

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              content += delta.content;
              finalText += delta.content;
              send({ type: "token", text: delta.content });
            }

            for (const tc of delta.tool_calls ?? []) {
              const idx = tc.index;
              const acc = (toolAcc[idx] ??= { id: "", name: "", args: "" });
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }

          const calls = Object.values(toolAcc).filter((c) => c.name);
          if (calls.length === 0) {
            break; // model produced a final answer
          }

          // Record the assistant's tool-call turn, then run each tool.
          messages.push({
            role: "assistant",
            content: content || null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.args || "{}" },
            })),
          });

          for (const c of calls) {
            send({
              type: "status",
              text: STATUS_FOR_TOOL[c.name] || "Working on it…",
            });
            let input: Record<string, unknown> = {};
            try {
              input = c.args ? JSON.parse(c.args) : {};
            } catch {
              /* malformed args — pass empty */
            }
            const result = await executeTool(c.name, input);
            messages.push({
              role: "tool",
              tool_call_id: c.id,
              content: result,
            });
          }
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
