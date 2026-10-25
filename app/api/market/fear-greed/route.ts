import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getFearGreed } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

/** GET /api/market/fear-greed — Crypto Fear & Greed Index (alternative.me, free). */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 30 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  try {
    const data = await getFearGreed();
    return NextResponse.json(
      { data, source: { provider: "alternative.me", fetchedAt: data.updatedAt } },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fear & Greed feed unavailable" },
      { status: 502 }
    );
  }
}
