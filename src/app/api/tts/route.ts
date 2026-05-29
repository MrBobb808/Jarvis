export const runtime = "nodejs";
export const maxDuration = 30;

// "Daniel" — a deep British voice that suits Jarvis. Override via env.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

/** Lets the client know whether to prefer ElevenLabs over browser TTS. */
export async function GET() {
  return Response.json({ configured: Boolean(process.env.ELEVENLABS_API_KEY) });
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return new Response("ElevenLabs not configured", { status: 503 });
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) {
    return new Response("Missing text", { status: 400 });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(detail || "TTS upstream error", {
      status: upstream.status || 502,
    });
  }

  // Stream the MP3 straight back to the browser.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
