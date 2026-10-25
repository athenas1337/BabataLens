import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { getTokenSecurity } from "@/lib/providers/market/intel";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  chainId: z.coerce.number().int().positive(),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "EVM contract address required (0x…)"),
});

/**
 * GET /api/security/token?chainId=1&address=0x…
 * Token safety scan (honeypot, taxes, mint rights) via GoPlus Security's free
 * API. Upstream is currently flaky/unreachable in some regions; failures are
 * surfaced as 502 so the UI can show an honest "scanner unavailable" state.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  if (!checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 20 }).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    chainId: searchParams.get("chainId") ?? "1",
    address: (searchParams.get("address") || "").trim(),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid chainId and 0x contract address." },
      { status: 400 }
    );
  }

  try {
    const data = await getTokenSecurity(parsed.data.chainId, parsed.data.address);
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
