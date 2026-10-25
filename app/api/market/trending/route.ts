import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getTrending } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/** GET /api/market/trending — hottest coins right now (CoinGecko, free). */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 30 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getTrending();
    return NextResponse.json(
      { data, source: { provider: "coingecko", fetchedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trending feed unavailable" },
      { status: 502 }
    );
  }
}
