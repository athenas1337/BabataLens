import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getDefiOverview } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" };

/**
 * GET /api/defi/overview — chain TVL leaders, top protocols, stablecoin totals.
 * Free via DefiLlama. The upstream payloads are large (~10MB on cold fetch) so
 * this route is rate-limited tighter than read-only market routes.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 15 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getDefiOverview();
    return NextResponse.json(
      { data, source: { provider: "defillama", fetchedAt: data.updatedAt } },
      { headers: CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "DeFi overview feed unavailable" },
      { status: 502 }
    );
  }
}
