import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getGlobalStats } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/** GET /api/market/global — total cap, dominance, volume (CoinGecko /global, free). */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 30 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getGlobalStats();
    return NextResponse.json(
      { data, source: { provider: "coingecko", fetchedAt: data.updatedAt } },
      { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Global market feed unavailable" },
      { status: 502 }
    );
  }
}
