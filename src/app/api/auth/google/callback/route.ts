import { exchangeCode } from "@/lib/google";
import { storeTokens } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${origin}/?error=${error || "no_code"}`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    await storeTokens(tokens);
    return Response.redirect(`${origin}/?connected=1`);
  } catch (err) {
    return Response.redirect(
      `${origin}/?error=${encodeURIComponent((err as Error).message)}`,
    );
  }
}
