import { getAuthedClient, getUserProfile, googleConfigured } from "@/lib/google";
import { clearTokens } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET() {
  const configured = googleConfigured();
  const auth = await getAuthedClient();
  if (!auth) {
    return Response.json({ configured, connected: false });
  }
  const profile = await getUserProfile(auth);
  return Response.json({ configured, connected: true, email: profile.email });
}

export async function DELETE() {
  await clearTokens();
  return Response.json({ ok: true });
}
