import { getAuthUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    return Response.redirect(`${origin}/?error=google_not_configured`);
  }
  const redirectUri = `${origin}/api/auth/google/callback`;
  return Response.redirect(getAuthUrl(redirectUri));
}
