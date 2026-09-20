// ==============================================================================
// BABATA LENS — COINMARKETCAP MARKET DATA ADAPTER
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
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class CoinMarketCapProvider implements MarketDataProvider {
  id = "coinmarketcap";
  name = "CoinMarketCap";
  capability = "market" as const;
  private baseUrl = "https://pro-api.coinmarketcap.com/v1";

  isConfigured(): boolean {
    return hasCredential("COINMARKETCAP_API_KEY");
  }

  async checkHealth(): Promise<ProviderHealthReport> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        capability: this.capability,
        status: "configured",
        lastCheckedAt: new Date().toISOString(),
        errorMessage: "Credentials not configured.",
      };
    }

    const startTime = Date.now();
    try {
      const env = getEnv();
      const res = await fetch(`${this.baseUrl}/key/info`, {
        headers: {
          "X-CMC_PRO_API_KEY": env.COINMARKETCAP_API_KEY || "",
          Accept: "application/json",
        },
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
      } else if (res.status === 401) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "invalid",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "Invalid CoinMarketCap API Key",
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

  async getTokenMarketData(query: TokenQuery): Promise<ProviderResult<TokenMarketData>> {
    const env = getEnv();
    if (!env.COINMARKETCAP_API_KEY) {
      throw new Error("[CoinMarketCap] Missing COINMARKETCAP_API_KEY");
    }

    const symbol = (query.symbol || "BTC").toUpperCase();
    const cacheKey = buildCacheKey(this.id, "quote", { symbol });

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
      `${this.baseUrl}/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbol)}`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": env.COINMARKETCAP_API_KEY,
          Accept: "application/json",
        },
      }
    );
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`CoinMarketCap API error (${res.status}): ${res.statusText}`);
    }

    const raw = (await res.json()) as {
      data?: Record<string, {
        id: number;
        name: string;
        symbol: string;
        quote?: {
          USD?: {
            price: number;
            percent_change_24h: number;
            market_cap: number;
            volume_24h: number;
          };
        };
        circulating_supply?: number;
        total_supply?: number;
        last_updated?: string;
      }>;
    };

    const tokenObj = raw.data?.[symbol];
    if (!tokenObj) {
      throw new Error(`Token ${symbol} not found on CoinMarketCap`);
    }

    const usd = tokenObj.quote?.USD;
    const normalized: TokenMarketData = {
      id: String(tokenObj.id),
      symbol: tokenObj.symbol,
      name: tokenObj.name,
      currentPriceUsd: usd?.price || 0,
      priceChange24hPercent: usd?.percent_change_24h || 0,
      marketCapUsd: usd?.market_cap,
      volume24hUsd: usd?.volume_24h,
      circulatingSupply: tokenObj.circulating_supply,
      totalSupply: tokenObj.total_supply,
      lastUpdated: tokenObj.last_updated || new Date().toISOString(),
    };

    await setCached(cacheKey, normalized, 45);

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
    // CoinMarketCap historical data endpoint is restricted on standard tiers,
    // Provide a graceful fallback or recent data representation
    return {
      data: [],
      source: {
        provider: this.id,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}
