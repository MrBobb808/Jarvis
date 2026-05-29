# JARVIS

A personal, voice-driven AI assistant — a dark, arc-reactor style interface with
voice in/out, a live conversational core powered by Claude, and a morning brief
that pulls from your Gmail, Google Calendar, and Google Drive.

![status](https://img.shields.io/badge/stack-Next.js%2016%20·%20Claude%20·%20Google%20APIs-22d3ee)

## Features

- **Animated voice orb** — canvas HUD that reacts to your mic level and the
  assistant's state (idle / listening / thinking / speaking).
- **Voice input** — Web Speech API (browser-native, no key needed).
- **Voice output** — natural **ElevenLabs** voice when configured, with an
  automatic fallback to browser Speech Synthesis. Mute toggle and optional
  auto-listen for hands-free back-and-forth.
- **Conversational core** — Claude with streaming responses and tool use, so it
  can actually read your inbox/calendar/Drive to answer.
- **Morning brief** — on load it summarizes your day: today's schedule, notable
  emails, and recent files.
- **Type or talk** — full text input fallback when voice isn't available.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the keys (see below)
npm run dev                  # http://localhost:3000
```

The UI, voice in/out, and orb work immediately. Conversation needs an Anthropic
key; the brief and email/calendar/Drive tools need Google OAuth.

## Configuration

### 1. Claude (required for conversation)

Add an `ANTHROPIC_API_KEY` from the [Anthropic console](https://console.anthropic.com/settings/keys).

### Optional: ElevenLabs (natural voice)

Add `ELEVENLABS_API_KEY` for a far more natural voice; otherwise the browser's
built-in TTS is used. Customize the voice with `ELEVENLABS_VOICE_ID`.

### 2. Google (required for Gmail / Calendar / Drive)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project.
2. Enable the **Gmail API**, **Google Calendar API**, and **Google Drive API**.
3. Create an **OAuth 2.0 Client ID** of type *Web application*.
4. Add the redirect URI `http://localhost:3000/api/auth/google/callback`
   (and your deployed URL's equivalent).
5. Put the client ID/secret in `.env.local`.
6. Run the app and click **Connect Google** in the header.

> Scopes are read-only (`gmail.readonly`, `calendar.readonly`, `drive.readonly`).
> Tokens are kept in an httpOnly cookie — fine for a personal deployment.

## Architecture

```
src/
  app/
    page.tsx                        # main interface
    api/
      chat/route.ts                 # streaming Claude loop with tool use (SSE)
      brief/route.ts                # morning brief
      auth/google/route.ts          # OAuth start
      auth/google/callback/route.ts # OAuth callback → stores tokens
      google/status/route.ts        # connection status + disconnect
  components/  VoiceOrb · ChatLog · MorningBrief
  hooks/       useJarvis · useSpeechRecognition · useSpeechSynthesis · useMicLevel
  lib/         anthropic · google · tools · tokens · types
```

The chat route runs an agentic loop: Claude may call `get_recent_emails`,
`get_calendar_events`, `search_drive`, or `get_current_datetime`; results are fed
back until it produces a final answer, which is streamed token-by-token to the UI.

## Deploy

Deploys cleanly to **Vercel**. Set `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, and
`GOOGLE_CLIENT_SECRET` as environment variables, and add your production callback
URL (`https://<your-domain>/api/auth/google/callback`) to the Google OAuth client.

## Notes & roadmap

- Voice recognition uses the Web Speech API (best support in Chrome/Edge).
- For a more natural voice, swap the browser TTS for ElevenLabs in
  `useSpeechSynthesis`.
- Next steps toward the full vision: multi-account Google, YouTube Data API,
  persistent memory, and a mobile shell.
