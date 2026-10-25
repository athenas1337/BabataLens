import { z } from "zod";
import { getCache } from "../../cache";

/**
 * Market & DeFi intel service — free, keyless public sources.
 *
 * All upstreams are open community APIs (alternative.me Fear & Greed,
 * CoinGecko public endpoints, DefiLlama, Blockscout, GoPlus Security). Every
 * result is cached server-side so the auto-refreshing UI can't hammer the
 * sources, and every parser fails loudly (route returns 502) instead of
 * inventing numbers — same data-integrity contract as the providers.
 */

const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = "BabataLens/1.0 (+https://github.com/athenas1337/BabataLens)";

async function fetchJson(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Intel source returned ${res.status}`);
  }
  return res.json();
}

async function cached<T>(name: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const cache = getCache();
  const key = cache.generateKey("intel", "feed", { name });
  const hit = await cache.get<T>(key);
  if (hit) return hit;
  const value = await load();
  await cache.set(key, value, ttlSeconds);
  return value;
}

// ── Fear & Greed Index (alternative.me) ──────────────────────────────

const FngSchema = z.object({
  data: z
    .array(
      z.object({
        value: z.string(),
        value_classification: z.string(),
        timestamp: z.string(),
      })
    )
    .min(1),
});

export interface FearGreed {
  value: number;
  classification: string;
  previousValue?: number;
  updatedAt: string;
}

export async function getFearGreed(): Promise<FearGreed> {
  return cached("fear-greed", 900, async () => {
    const parsed = FngSchema.safeParse(await fetchJson("https://api.alternative.me/fng/?limit=2"));
    if (!parsed.success) throw new Error("Fear & Greed feed returned unexpected data");
    const latest = parsed.data.data[0];
    return {
      value: Number(latest.value),
      classification: latest.value_classification,
      previousValue: parsed.data.data[1] ? Number(parsed.data.data[1].value) : undefined,
      updatedAt: new Date(Number(latest.timestamp) * 1000).toISOString(),
    };
  });
}

// ── Global market stats (CoinGecko /global) ──────────────────────────

const GlobalSchema = z.object({
  data: z.object({
    active_cryptocurrencies: z.number(),
    total_market_cap: z.object({ usd: z.number() }),
    total_volume: z.object({ usd: z.number() }),
    market_cap_change_percentage_24h_usd: z.number(),
    market_cap_percentage: z.object({ btc: z.number(), eth: z.number() }),
  }),
});

export interface GlobalStats {
  activeCoins: number;
  totalMarketCapUsd: number;
  marketCapChange24hPct: number;
  totalVolumeUsd: number;
  btcDominancePct: number;
  ethDominancePct: number;
  updatedAt: string;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  return cached("global-stats", 300, async () => {
    const parsed = GlobalSchema.safeParse(
      await fetchJson("https://api.coingecko.com/api/v3/global")
    );
    if (!parsed.success) throw new Error("Global market feed returned unexpected data");
    const d = parsed.data.data;
    return {
      activeCoins: d.active_cryptocurrencies,
      totalMarketCapUsd: d.total_market_cap.usd,
      marketCapChange24hPct: d.market_cap_change_percentage_24h_usd,
      totalVolumeUsd: d.total_volume.usd,
      btcDominancePct: d.market_cap_percentage.btc,
      ethDominancePct: d.market_cap_percentage.eth,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ── Trending coins (CoinGecko /search/trending) ──────────────────────

const TrendingSchema = z.object({
  coins: z.array(
    z.object({
      item: z.object({
        id: z.string(),
        symbol: z.string(),
        name: z.string(),
        market_cap_rank: z.number().nullable(),
        data: z
          .object({
            price: z.number().nullable(),
            price_change_percentage_24h: z
              .object({ usd: z.number() })
              .nullable()
              .optional(),
          })
          .optional(),
      }),
    })
  ),
});

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank?: number;
  priceUsd?: number;
  change24hPct?: number;
}

/** Pure mapper — exported for regression tests. */
export function mapTrending(raw: unknown, limit = 6): TrendingCoin[] {
  const parsed = TrendingSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Trending feed returned unexpected data");
  return parsed.data.coins.slice(0, limit).map(({ item }) => ({
    id: item.id,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    rank: item.market_cap_rank ?? undefined,
    priceUsd: item.data?.price ?? undefined,
    change24hPct: item.data?.price_change_percentage_24h?.usd ?? undefined,
  }));
}

export async function getTrending(): Promise<TrendingCoin[]> {
  return cached("trending", 600, async () =>
    mapTrending(await fetchJson("https://api.coingecko.com/api/v3/search/trending"))
  );
}

// ── Ethereum gas (Blockscout stats) ──────────────────────────────────

const GasSchema = z.object({
  gas_prices: z.object({
    slow: z.number(),
    average: z.number(),
    fast: z.number(),
  }),
  gas_price_updated_at: z.string().optional(),
});

export interface EthGas {
  slowGwei: number;
  averageGwei: number;
  fastGwei: number;
  updatedAt: string;
}

export async function getEthGas(): Promise<EthGas> {
  return cached("eth-gas", 30, async () => {
    const parsed = GasSchema.safeParse(
      await fetchJson("https://eth.blockscout.com/api/v2/stats")
    );
    if (!parsed.success) throw new Error("Gas feed returned unexpected data");
    const g = parsed.data.gas_prices;
    return {
      slowGwei: g.slow,
      averageGwei: g.average,
      fastGwei: g.fast,
      updatedAt: parsed.data.gas_price_updated_at ?? new Date().toISOString(),
    };
  });
}

// ── DeFi overview (DefiLlama) ────────────────────────────────────────

const LlamaChainSchema = z.object({
  name: z.string(),
  tvl: z.number(),
});

const LlamaProtocolSchema = z.object({
  name: z.string(),
  tvl: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  change_1d: z.number().nullable().optional(),
});

const LlamaStablecoinSchema = z.object({
  totalCirculatingUSD: z.object({ peggedUSD: z.number() }).optional(),
  peggedAssets: z
    .array(
      z.object({
        name: z.string(),
        symbol: z.string(),
        circulating: z.object({ peggedUSD: z.number().nullable().optional() }).optional(),
      })
    )
    .min(1),
});

export interface DefiOverview {
  totalTvlUsd: number;
  topChains: { name: string; tvlUsd: number }[];
  topProtocols: { name: string; category?: string; tvlUsd: number; change24hPct?: number }[];
  stablecoins: { totalUsd: number; top: { symbol: string; name: string; usd: number }[] };
  updatedAt: string;
}

/** Pure helpers — exported for regression tests. */
export function topByTvl<T extends { tvl: number | null | undefined; name: string }>(
  items: T[],
  limit: number
): { name: string; tvlUsd: number }[] {
  return items
    .filter((c) => typeof c.tvl === "number" && c.tvl > 0)
    .sort((a, b) => (b.tvl as number) - (a.tvl as number))
    .slice(0, limit)
    .map((c) => ({ name: c.name, tvlUsd: c.tvl as number }));
}

export function pickStablecoinTop(
  raw: unknown,
  limit = 5
): { totalUsd: number; top: { symbol: string; name: string; usd: number }[] } {
  const parsed = LlamaStablecoinSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Stablecoin feed returned unexpected data");
  const assets = parsed.data.peggedAssets
    .filter((a) => typeof a.circulating?.peggedUSD === "number")
    .sort(
      (a, b) => (b.circulating?.peggedUSD ?? 0) - (a.circulating?.peggedUSD ?? 0)
    )
    .slice(0, limit)
    .map((a) => ({
      symbol: a.symbol,
      name: a.name,
      usd: a.circulating?.peggedUSD as number,
    }));
  const total =
    parsed.data.totalCirculatingUSD?.peggedUSD ??
    assets.reduce((sum, a) => sum + a.usd, 0);
  return { totalUsd: total, top: assets };
}

export async function getDefiOverview(): Promise<DefiOverview> {
  return cached("defi-overview", 900, async () => {
    const [chainsRaw, protocolsRaw, stablesRaw] = await Promise.all([
      fetchJson("https://api.llama.fi/v2/chains", 15000),
      fetchJson("https://api.llama.fi/protocols", 25000),
      fetchJson("https://stablecoins.llama.fi/stablecoins?includePrices=false", 15000),
    ]);

    const chains = z.array(LlamaChainSchema).min(1).parse(chainsRaw);
    const topChains = topByTvl(chains, 10);
    const totalTvlUsd = chains.reduce((s, c) => s + (c.tvl > 0 ? c.tvl : 0), 0);

    const protocols = z.array(LlamaProtocolSchema).min(1).parse(protocolsRaw);
    const topProtocols = protocols
      .filter((p) => typeof p.tvl === "number" && (p.tvl as number) > 0)
      .sort((a, b) => (b.tvl as number) - (a.tvl as number))
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        category: p.category ?? undefined,
        tvlUsd: p.tvl as number,
        change24hPct: p.change_1d ?? undefined,
      }));

    const stablecoins = pickStablecoinTop(stablesRaw, 5);

    return {
      totalTvlUsd,
      topChains,
      topProtocols,
      stablecoins,
      updatedAt: new Date().toISOString(),
    };
  });
}

// ── Stablecoin yields (DefiLlama yields) ─────────────────────────────

const LlamaPoolSchema = z.object({
  project: z.string(),
  chain: z.string(),
  symbol: z.string(),
  tvlUsd: z.number(),
  apy: z.number().nullable().optional(),
  stablecoin: z.boolean().nullable().optional(),
});

export interface YieldPool {
  project: string;
  chain: string;
  pair: string;
  tvlUsd: number;
  apyPct: number;
}

/** Pure filter+sort — exported for regression tests. */
export function pickStableYields(raw: unknown, limit = 10): YieldPool[] {
  const parsed = z.object({ data: z.array(LlamaPoolSchema).min(1) }).safeParse(raw);
  if (!parsed.success) throw new Error("Yield pools feed returned unexpected data");
  return parsed.data.data
    .filter(
      (p) =>
        p.stablecoin === true &&
        p.tvlUsd >= 10_000_000 &&
        typeof p.apy === "number" &&
        p.apy > 0.1 &&
        p.apy <= 100
    )
    .sort((a, b) => (b.apy as number) - (a.apy as number))
    .slice(0, limit)
    .map((p) => ({
      project: p.project,
      chain: p.chain,
      pair: p.symbol,
      tvlUsd: p.tvlUsd,
      apyPct: p.apy as number,
    }));
}

export async function getStableYields(): Promise<YieldPool[]> {
  return cached("stable-yields", 900, async () =>
    pickStableYields(await fetchJson("https://yields.llama.fi/pools", 25000))
  );
}

// ── Token & address security (GoPlus) ────────────────────────────────

export type SecurityLevel = "high" | "medium" | "low" | "info";

const GOPLUS_CHAINS = new Set([1, 56, 137, 42161, 10, 8453, 43114]);

export function isSupportedSecurityChain(chainId: number): boolean {
  return GOPLUS_CHAINS.has(chainId);
}

/** GoPlus encodes booleans as "0"/"1" strings (or, inconsistently, objects). */
function asFlag(v: unknown): boolean | null {
  if (typeof v === "string") {
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  }
  if (typeof v === "object" && v !== null && "status" in (v as Record<string, unknown>)) {
    return asFlag((v as { status: unknown }).status);
  }
  return null;
}

function asFraction(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface SecurityFlag {
  label: string;
  level: SecurityLevel;
}

export interface TokenSecurityReport {
  address: string;
  chainId: number;
  riskLevel: SecurityLevel;
  summary: string;
  honeypot: boolean | null;
  openSource: boolean | null;
  mintable: boolean | null;
  buyTaxPct?: number;
  sellTaxPct?: number;
  holderCount?: number;
  ownerAddress?: string;
  flags: SecurityFlag[];
}

const TokenSecurityResultSchema = z.record(z.unknown());

function worst(flags: SecurityFlag[]): SecurityLevel {
  if (flags.some((f) => f.level === "high")) return "high";
  if (flags.some((f) => f.level === "medium")) return "medium";
  return "low";
}

/**
 * Pure assessor — exported for regression tests. GoPlus raw rows vary in
 * shape between versions, so every read is defensive; unknown shapes are
 * treated as "unknown" and never as a clean bill of health.
 */
export function assessTokenSecurity(
  address: string,
  chainId: number,
  rawRow: unknown
): TokenSecurityReport {
  const row =
    TokenSecurityResultSchema.safeParse(rawRow).success
      ? (rawRow as Record<string, unknown>)
      : {};

  const flags: SecurityFlag[] = [];
  const honeypot = asFlag(row.honeypot);
  const openSource = asFlag(row.is_open_source);
  const mintable = asFlag(row.is_mintable);
  const buyTax = asFraction(row.buy_tax);
  const sellTax = asFraction(row.sell_tax);
  const holderCountRaw = Number(row.holder_count);
  const holderCount = Number.isFinite(holderCountRaw) ? holderCountRaw : undefined;
  const ownerAddress =
    typeof row.owner_address === "string" && row.owner_address ? row.owner_address : undefined;

  if (honeypot === true) flags.push({ label: "HONEYPOT — sells are trapped", level: "high" });
  if (openSource === false) flags.push({ label: "Source code not verified", level: "high" });
  if (mintable === true) flags.push({ label: "Owner can mint new supply", level: "medium" });
  if (asFlag(row.slippage_modifiable) === true)
    flags.push({ label: "Trading slippage modifiable", level: "medium" });
  if (asFlag(row.transfer_pausable) === true)
    flags.push({ label: "Transfers can be paused", level: "medium" });
  if (asFlag(row.is_blacklisted) === true)
    flags.push({ label: "Blacklist mechanism present", level: "medium" });
  if (asFlag(row.is_anti_whale) === true)
    flags.push({ label: "Anti-whale trade limit", level: "info" });
  if (asFlag(row.is_whitelisted) === true)
    flags.push({ label: "Whitelist mechanism present", level: "info" });

  for (const [label, tax] of [
    ["Buy tax", buyTax],
    ["Sell tax", sellTax],
  ] as const) {
    if (tax === null) continue;
    const pct = tax * 100;
    if (pct >= 50) flags.push({ label: `${label} ${pct.toFixed(0)}% — predatory`, level: "high" });
    else if (pct >= 10) flags.push({ label: `${label} ${pct.toFixed(0)}%`, level: "medium" });
    else if (pct > 0) flags.push({ label: `${label} ${pct.toFixed(1)}%`, level: "info" });
  }

  const riskLevel = worst(flags);
  let summary: string;
  if (honeypot === true) summary = "DANGEROUS: this token appears to be a honeypot.";
  else if (riskLevel === "high") summary = "High-risk token. Multiple serious red flags detected.";
  else if (riskLevel === "medium") summary = "Caution: owner-controlled capabilities detected.";
  else if (openSource === true) summary = "No major red flags in the scanned dimensions.";
  else summary = "Scanned, but some dimensions were unavailable — verify independently.";

  return {
    address,
    chainId,
    riskLevel,
    summary,
    honeypot,
    openSource,
    mintable,
    buyTaxPct: buyTax !== null ? buyTax * 100 : undefined,
    sellTaxPct: sellTax !== null ? sellTax * 100 : undefined,
    holderCount,
    ownerAddress,
    flags,
  };
}

export async function getTokenSecurity(
  chainId: number,
  address: string
): Promise<TokenSecurityReport> {
  if (!isSupportedSecurityChain(chainId)) {
    throw new Error(`Security scan not supported for chain id ${chainId}.`);
  }
  return cached("token-security", 600, async () => {
    const raw = await fetchJson(
      `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${address}`,
      15000
    );
    const parsed = z
      .object({ code: z.number(), result: TokenSecurityResultSchema.nullable().optional() })
      .safeParse(raw);
    if (!parsed.success || parsed.data.code !== 0) {
      throw new Error("Token security feed returned an unexpected response.");
    }
    const row = parsed.data.result?.[address.toLowerCase()];
    if (!row) {
      return {
        address,
        chainId,
        riskLevel: "info",
        summary:
          "No GoPlus data for this contract on this chain — treat as unscanned and verify independently.",
        honeypot: null,
        openSource: null,
        mintable: null,
        flags: [],
      };
    }
    return assessTokenSecurity(address, chainId, row);
  });
}

export interface AddressSecurityReport {
  address: string;
  riskLevel: SecurityLevel;
  summary: string;
  isContract: boolean | null;
  flags: SecurityFlag[];
}

/** Pure assessor — exported for regression tests. */
export function assessAddressSecurity(address: string, rawRow: unknown): AddressSecurityReport {
  const row =
    TokenSecurityResultSchema.safeParse(rawRow).success
      ? (rawRow as Record<string, unknown>)
      : {};

  const flags: SecurityFlag[] = [];
  const isContract = asFlag(row.is_contract);
  if (asFlag(row.is_money_laundering) === true)
    flags.push({ label: "Flagged in money-laundering lists", level: "high" });
  if (asFlag(row.is_blacklisted) === true)
    flags.push({ label: "Blacklisted address", level: "high" });
  if (asFlag(row.is_contract) === true)
    flags.push({ label: "Smart contract (not an EOA)", level: "info" });

  const riskLevel = worst(flags);
  return {
    address,
    riskLevel,
    summary:
      riskLevel === "high"
        ? "This address appears on risk lists — proceed with extreme caution."
        : "No risk-list hits found for this address.",
    isContract,
    flags,
  };
}

export async function getAddressSecurity(address: string): Promise<AddressSecurityReport> {
  return cached("address-security", 600, async () => {
    const raw = await fetchJson(
      `https://api.gopluslabs.com/api/v1/address_security/${address}?chain_id=1`,
      15000
    );
    const parsed = z
      .object({ code: z.number(), result: TokenSecurityResultSchema.optional() })
      .safeParse(raw);
    if (!parsed.success || parsed.data.code !== 0) {
      throw new Error("Address security feed returned an unexpected response.");
    }
    return assessAddressSecurity(address, parsed.data.result ?? {});
  });
}
