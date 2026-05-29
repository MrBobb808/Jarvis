import { cookies } from "next/headers";
import type { Credentials } from "google-auth-library";

const COOKIE = "jarvis_google_tokens";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * Token persistence for the user's Google OAuth credentials.
 *
 * For a single-user personal MVP we keep the (long-lived) refresh token in an
 * httpOnly, secure cookie. This is fine for a private deployment; a multi-user
 * product would move this into an encrypted server-side store.
 */
export async function storeTokens(tokens: Credentials): Promise<void> {
  const jar = await cookies();
  const existing = await getStoredTokens();
  // Google omits the refresh_token on subsequent consents — keep the old one.
  const merged: Credentials = {
    ...existing,
    ...tokens,
    refresh_token: tokens.refresh_token || existing?.refresh_token,
  };
  jar.set(COOKIE, Buffer.from(JSON.stringify(merged)).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getStoredTokens(): Promise<Credentials | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Credentials;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
