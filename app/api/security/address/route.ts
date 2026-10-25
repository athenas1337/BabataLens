import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getAddressSecurity } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "EVM address required (0x…)"),
});

/**
 * GET /api/security/address?address=0x…
 * Wallet/contract risk-list scan via GoPlus Security's free API. Purely
 * informational; absent flags are not proof of safety.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 20 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const parsed = QuerySchema.safeParse({
    address: (new URL(req.url).searchParams.get("address") || "").trim(),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid 0x address." }, { status: 400 });
  }

  try {
    const data = await getAddressSecurity(parsed.data.address);
    return NextResponse.json(
      { data, source: { provider: "goplus", fetchedAt: new Date().toISOString() } },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Security scanner unavailable" },
      { status: 502 }
    );
  }
}
