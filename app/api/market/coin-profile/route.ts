import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getCoinProfile } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/coin-profile?id=bitcoin
 * Deep-dive profile for one coin: description, categories, ATH/ATL, supplies,
 * links. Free via CoinGecko. Invalid slugs are a 400; unknown ids a 404.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 30 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!id || !/^[a-z0-9-]{1,40}$/.test(id)) {
    return NextResponse.json({ error: "Provide a valid coin id slug." }, { status: 400 });
  }

  try {
    const data = await getCoinProfile(id);
    return NextResponse.json(
      { data, source: { provider: "coingecko", fetchedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Coin profile feed unavailable";
    const notFound = /unexpected data|invalid coin id/i.test(message);
    return NextResponse.json(
      { error: notFound ? "No profile found for this coin id." : message },
      { status: notFound ? 404 : 502 }
    );
  }
}
