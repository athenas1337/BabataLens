import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getBtcNetwork } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/btc-network — Bitcoin network vitals: tip height,
 * recommended fees, mempool backlog, difficulty retarget. Free via
 * mempool.space. Sub-feed failures stay optional (unknown), never zero.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 60 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getBtcNetwork();
    return NextResponse.json(
      { data, source: { provider: "mempool.space", fetchedAt: data.updatedAt } },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BTC network feed unavailable" },
      { status: 502 }
    );
  }
}
