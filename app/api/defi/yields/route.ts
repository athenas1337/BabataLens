import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getStableYields } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/**
 * GET /api/defi/yields — highest-APY stablecoin pools with meaningful TVL.
 * Free via DefiLlama yields. APYs are point-in-time and can change fast; the
 * UI must present them as observations, not offers.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 15 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getStableYields();
    return NextResponse.json(
      { data, source: { provider: "defillama-yields", fetchedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=900" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Yield feed unavailable" },
      { status: 502 }
    );
  }
}
