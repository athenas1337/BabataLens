import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getPortfolioPrices, sanitizePortfolioIds } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/portfolio?ids=bitcoin,ethereum
 * Batch live prices for the user's localStorage portfolio (CoinGecko
 * /coins/markets, free). Ids are slugs validated against a strict charset;
 * unknown ids simply come back absent, never invented.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 60 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const ids = sanitizePortfolioIds(new URL(req.url).searchParams.get("ids") || "");
  if (ids.length === 0) {
    return NextResponse.json({ data: [], source: { provider: "coingecko", fetchedAt: new Date().toISOString() } });
  }

  try {
    const data = await getPortfolioPrices(ids);
    return NextResponse.json(
      { data, source: { provider: "coingecko", fetchedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portfolio price feed unavailable" },
      { status: 502 }
    );
  }
}
