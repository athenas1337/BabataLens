import { getCache } from "../../cache";
import { logger } from "../../observability/logger";

/**
 * Live entity-wallet flows (Arkham-style, free).
 *
 * Data source: Blockscout public explorers' v2 REST API — keyless, free, and
 * permissive. Each watched wallet's most recent ERC-20 transfers are fetched,
 * directionally classified (in/out), USD-valued with the token's on-explorer
 * exchange rate, and merged into one time-ordered feed.
 *
 * Not every Blockscout instance permits API access; CHAIN_HOSTS lists the ones
 * that do. Adding a chain here requires verifying the endpoint answers 200.
 */
export const FLOW_CHAINS = {
  ethereum: "https://eth.blockscout.com",
  optimism: "https://explorer.optimism.io",
} as const;

export type FlowChain = keyof typeof FLOW_CHAINS;

export function isFlowChain(chain: string): chain is FlowChain {
  return chain in FLOW_CHAINS;
}

export interface FlowWallet {
  address: string;
  label: string;
  type: string;
  origin: "default" | "env" | "user";
}

export interface LiveFlow {
  chain: string;
  walletAddress: string;
  walletLabel: string;
  direction: "in" | "out";
  tokenSymbol: string;
  tokenName?: string;
  tokenAddress?: string;
  amount: number;
  valueUsd?: number;
  counterparty: string;
  txHash: string;
  timestamp: string;
}

export interface LiveFlowsResult {
  flows: LiveFlow[];
  failed: string[];
}

interface BlockscoutTokenTransfer {
  token: {
    address?: string;
    symbol?: string;
    name?: string;
    decimals?: string;
    type?: string;
    exchange_rate?: string | null;
  } | null;
  total: { value?: string } | null;
  from: { hash?: string } | null;
  to: { hash?: string } | null;
  tx_hash?: string;
  timestamp?: string;
}

/** Token amount from a base-unit string, tolerating 0-decimal and odd tokens. */
function tokenAmount(raw: string, decimalsRaw: string | undefined): number {
  const parsedDecimals = Number.parseInt(decimalsRaw ?? "18", 10);
  const decimals =
    Number.isFinite(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 36
      ? parsedDecimals
      : 18;
  const value = Number(raw) / 10 ** decimals;
  return Number.isFinite(value) ? value : 0;
}

async function fetchWalletFlows(
  host: string,
  chain: string,
  wallet: FlowWallet
): Promise<LiveFlow[]> {
  const res = await fetch(
    `${host}/api/v2/addresses/${wallet.address}/token-transfers`,
    {
      signal: AbortSignal.timeout(9000),
      headers: {
        accept: "application/json",
        // Some Blockscout fronts reject UA-less API requests with 403.
        "User-Agent": "BabataLens/1.0 (+https://github.com/athenas1337/BabataLens)",
      },
    }
  );
  if (!res.ok) {
    throw new Error(`explorer returned ${res.status} for ${wallet.label}`);
  }
  const json = (await res.json()) as { items?: BlockscoutTokenTransfer[] };
  const me = wallet.address.toLowerCase();
  const flows: LiveFlow[] = [];

  for (const t of json.items ?? []) {
    if (!t.token || !t.token.symbol) continue;
    // ERC-20 only: NFT/721/1155 rows have no meaningful USD value here.
    if (t.token.type && t.token.type !== "ERC-20") continue;

    const from = (t.from?.hash ?? "").toLowerCase();
    const to = (t.to?.hash ?? "").toLowerCase();
    if (from !== me && to !== me) continue;

    const amount = tokenAmount(t.total?.value ?? "0", t.token.decimals);
    const rate = t.token.exchange_rate ? parseFloat(t.token.exchange_rate) : undefined;
    const valueUsd =
      rate !== undefined && Number.isFinite(rate) && rate > 0 ? amount * rate : undefined;

    flows.push({
      chain,
      walletAddress: wallet.address,
      walletLabel: wallet.label,
      direction: to === me ? "in" : "out",
      tokenSymbol: t.token.symbol,
      tokenName: t.token.name,
      tokenAddress: t.token.address,
      amount,
      valueUsd,
      counterparty: to === me ? from : to,
      txHash: t.tx_hash ?? "",
      timestamp: t.timestamp ?? "",
    });
  }
  return flows;
}

/**
 * Fetch the latest token flows for a set of watched wallets on one chain.
 * Individual wallet failures don't fail the request; only total failure throws.
 * Results are cached for 45s per (chain, wallet-set) so the auto-refreshing UI
 * can't hammer the explorer.
 */
export async function fetchLiveFlows(opts: {
  chain: FlowChain;
  wallets: FlowWallet[];
  limit?: number;
}): Promise<LiveFlowsResult> {
  const host = FLOW_CHAINS[opts.chain];
  const limit = opts.limit ?? 40;

  const cache = getCache();
  const cacheKey = cache.generateKey("live-flows", opts.chain, {
    wallets: opts.wallets.map((w) => w.address).sort(),
    limit,
  });
  const cached = await cache.get<LiveFlowsResult>(cacheKey);
  if (cached) return cached;

  const settled = await Promise.allSettled(
    opts.wallets.map((w) => fetchWalletFlows(host, opts.chain, w))
  );

  const failed: string[] = [];
  const flows: LiveFlow[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      flows.push(...r.value);
    } else {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      failed.push(`${opts.wallets[i].label}: ${reason}`);
      logger.warn("Live flows wallet query failed", {
        errorCode: "LIVE_FLOW_WALLET_FAILED",
        data: { chain: opts.chain, wallet: opts.wallets[i].address, error: reason },
      });
    }
  });

  if (flows.length === 0 && failed.length === opts.wallets.length && opts.wallets.length > 0) {
    throw new Error("Live flow explorer is unreachable. Try again shortly.");
  }

  flows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const result: LiveFlowsResult = { flows: flows.slice(0, limit), failed };
  await cache.set(cacheKey, result, 45);
  return result;
}
