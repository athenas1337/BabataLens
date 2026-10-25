import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { authenticateRequest, unauthorizedResponse } from "@/lib/security/auth";
import { logger } from "@/lib/observability/logger";
import {
  FLOW_CHAINS,
  fetchLiveFlows,
  isFlowChain,
  FlowWallet,
} from "@/lib/providers/smartmoney/live-flows";
import {
  DEFAULT_WATCHLIST,
  envWatchlist,
  isValidEvmAddress,
} from "@/lib/providers/smartmoney/watchlist";

export const dynamic = "force-dynamic";

const MAX_USER_ADDRESSES = 8;
const MAX_TOTAL_WALLETS = 12;

/**
 * GET /api/smart-money/flows?chain=ethereum&addresses=0x..,0x..&limit=40
 *
 * Arkham-style live entity flows, free: recent ERC-20 transfers of a curated
 * watchlist of publicly-known wallets (plus optional caller-supplied
 * addresses), keyless via Blockscout explorers. Unlike the holdings/netflows
 * views this never needs a paid key — `configured` is always true on supported
 * chains; unsupported chains are a 400, not an unlock prompt.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedResponse();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = checkRateLimit("ip", ip, { windowMs: 60 * 1000, max: 30 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait a moment." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(req.url);
  const chain = (searchParams.get("chain") || "ethereum").toLowerCase();
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(searchParams.get("limit") || "40", 10) || 40, 60)
  );

  if (!isFlowChain(chain)) {
    return NextResponse.json(
      {
        error: `Live flows currently support: ${Object.keys(FLOW_CHAINS).join(", ")}.`,
        supportedChains: Object.keys(FLOW_CHAINS),
      },
      { status: 400 }
    );
  }

  // Caller-supplied addresses are optional extras on top of the built-in list.
  const extraRaw = (searchParams.get("addresses") || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, MAX_USER_ADDRESSES);
  const invalid = extraRaw.filter((a) => !isValidEvmAddress(a));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid address: ${invalid[0]}` },
      { status: 400 }
    );
  }

  // The default watchlist's labels are ethereum-mainnet facts; the same EOAs on
  // other chains are not provably the same entity, so only user/env addresses
  // flow there.
  const wallets: FlowWallet[] = [];
  const seen = new Set<string>();
  const push = (w: FlowWallet) => {
    const key = w.address.toLowerCase();
    if (seen.has(key) || wallets.length >= MAX_TOTAL_WALLETS) return;
    seen.add(key);
    wallets.push(w);
  };

  if (chain === "ethereum") {
    DEFAULT_WATCHLIST.forEach((w) =>
      push({ address: w.address, label: w.label, type: w.type, origin: "default" })
    );
    envWatchlist().forEach((w) =>
      push({ address: w.address, label: w.label, type: w.type, origin: "env" })
    );
  } else {
    envWatchlist().forEach((w) =>
      push({ address: w.address, label: w.label, type: w.type, origin: "env" })
    );
  }
  extraRaw.forEach((address, i) =>
    push({
      address,
      label: `Watched ${address.slice(0, 6)}…${address.slice(-4)} (${i + 1})`,
      type: "Custom",
      origin: "user",
    })
  );

  if (wallets.length === 0) {
    return NextResponse.json(
      {
        configured: true,
        view: "flows",
        chain,
        flows: [],
        wallets: [],
        failed: [],
        supportedChains: Object.keys(FLOW_CHAINS),
        message:
          chain === "ethereum"
            ? "No wallets to watch."
            : "Built-in entity labels are Ethereum-only on this free source — add an address below to watch it on this chain.",
        source: { provider: "blockscout", fetchedAt: new Date().toISOString() },
      },
      {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
      }
    );
  }

  try {
    const result = await fetchLiveFlows({ chain, wallets, limit });
    return NextResponse.json(
      {
        configured: true,
        view: "flows",
        chain,
        flows: result.flows,
        wallets,
        failed: result.failed,
        supportedChains: Object.keys(FLOW_CHAINS),
        source: { provider: "blockscout", fetchedAt: new Date().toISOString() },
      },
      {
        headers: {
          // Authenticated payload: browser cache only, never a shared CDN.
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Live flows query failed";
    logger.warn("Live flows request failed", {
      errorCode: "LIVE_FLOWS_FAILED",
      data: { chain, error: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
