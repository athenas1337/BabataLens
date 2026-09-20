// ==============================================================================
// BABATA LENS — COINGECKO MARKET DATA ADAPTER
// ==============================================================================

import {
  MarketDataProvider,
  ProviderResult,
  TokenMarketData,
  PricePoint,
  TokenQuery,
  TimeRange,
  ProviderHealthReport,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";
import {
  normalizeCoinGeckoToken,
  normalizeCoinGeckoChart,
} from "../../../normalize/schemas";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class CoinGeckoProvider implements MarketDataProvider {
  id = "coingecko";
  name = "CoinGecko";
  capability = "market" as const;
  private baseUrl = "https://api.coingecko.com/api/v3";

  isConfigured(): boolean {
    // CoinGecko can operate on free tier or with demo/pro API key
    return true;
  }

  private getHeaders(): HeadersInit {
    const env = getEnv();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;
    }
    return headers;
  }

  async checkHealth(): Promise<ProviderHealthReport> {
    const startTime = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/ping`, {
        headers: this.getHeaders(),
      });
      const latency = Date.now() - startTime;
      if (res.ok) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "connected",
          lastSuccessAt: new Date().toISOString(),
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
        };
      } else if (res.status === 429) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "rate_limited",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "CoinGecko rate limit reached",
        };
      } else {
        return {
          provider: this.id,
          capability: this.capability,
          status: "degraded",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: `HTTP ${res.status}`,
        };
      }
    } catch (err: unknown) {
      return {
        provider: this.id,
        capability: this.capability,
        status: "unavailable",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  private resolveCoinId(query: TokenQuery): string {
    const sym = (query.symbol || query.id || "bitcoin").toLowerCase();
    const map: Record<string, string> = {
      btc: "bitcoin",
      eth: "ethereum",
      sol: "solana",
      bnb: "binancecoin",
      usdt: "tether",
      usdc: "usd-coin",
      xrp: "ripple",
      doge: "dogecoin",
      ada: "cardano",
      avax: "avalanche-2",
      link: "chainlink",
      near: "near",
      sui: "sui",
      apt: "aptos",
    };
    return map[sym] || sym;
  }

  async getTokenMarketData(query: TokenQuery): Promise<ProviderResult<TokenMarketData>> {
    const coinId = this.resolveCoinId(query);
    const cacheKey = buildCacheKey(this.id, "token", { coinId });

    const cached = await getCached<TokenMarketData>(cacheKey);
    if (cached) {
      return {
        data: cached,
        source: {
          provider: this.id,
          fetchedAt: new Date().toISOString(),
          cached: true,
        },
      };
    }

    const startTime = Date.now();
    const res = await fetch(
      `${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { headers: this.getHeaders() }
    );
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`CoinGecko market data error (${res.status}): ${res.statusText}`);
    }

    const raw = await res.json();
    const normalized = normalizeCoinGeckoToken(raw);

    // Cache for 30s
    await setCached(cacheKey, normalized, 30);

    return {
      data: normalized,
      source: {
        provider: this.id,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }

  async getMarketHistory(
    query: TokenQuery,
    range: TimeRange
  ): Promise<ProviderResult<PricePoint[]>> {
    const coinId = this.resolveCoinId(query);
    const daysMap: Record<TimeRange, string> = {
      "1d": "1",
      "7d": "7",
      "30d": "30",
      "90d": "90",
      "1y": "365",
      all: "max",
    };
    const days = daysMap[range] || "7";
    const cacheKey = buildCacheKey(this.id, "chart", { coinId, days });

    const cached = await getCached<PricePoint[]>(cacheKey);
    if (cached) {
      return {
        data: cached,
        source: {
          provider: this.id,
          fetchedAt: new Date().toISOString(),
          cached: true,
        },
      };
    }

    const startTime = Date.now();
    const res = await fetch(
      `${this.baseUrl}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      { headers: this.getHeaders() }
    );
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`CoinGecko chart error (${res.status}): ${res.statusText}`);
    }

    const raw = await res.json();
    const normalized = normalizeCoinGeckoChart(raw);

    // Cache for 2 minutes
    await setCached(cacheKey, normalized, 120);

    return {
      data: normalized,
      source: {
        provider: this.id,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }
}
