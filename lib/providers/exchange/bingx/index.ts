// ==============================================================================
// BABATA LENS — BINGX EXCHANGE DATA ADAPTER
// ==============================================================================

import {
  ExchangeDataProvider,
  ProviderResult,
  TickerData,
  ProviderHealthReport,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";
import { normalizeBingXTicker } from "../../../normalize/schemas";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class BingXProvider implements ExchangeDataProvider {
  id = "bingx";
  name = "BingX Exchange";
  capability = "exchange" as const;
  private baseUrl = "https://open-api.bingx.com";

  isConfigured(): boolean {
    return hasCredential("BINGX_API_KEY");
  }

  async checkHealth(): Promise<ProviderHealthReport> {
    const startTime = Date.now();
    try {
      // Public server time endpoint
      const res = await fetch(`${this.baseUrl}/openApi/swap/v2/server/time`);
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
      } else {
        return {
          provider: this.id,
          capability: this.capability,
          status: "degraded",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: `Status ${res.status}`,
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

  async getExchangeTicker(symbol: string): Promise<ProviderResult<TickerData>> {
    // Format symbol: e.g. BTC -> BTC-USDT
    let formattedSymbol = symbol.toUpperCase();
    if (!formattedSymbol.includes("-") && !formattedSymbol.includes("USDT")) {
      formattedSymbol = `${formattedSymbol}-USDT`;
    }

    const cacheKey = buildCacheKey(this.id, "ticker", { symbol: formattedSymbol });
    const cached = await getCached<TickerData>(cacheKey);
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
      `${this.baseUrl}/openApi/swap/v2/quote/ticker?symbol=${encodeURIComponent(formattedSymbol)}`
    );
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`BingX ticker error (${res.status}): ${res.statusText}`);
    }

    const raw = await res.json();
    const normalized = normalizeBingXTicker(raw);

    await setCached(cacheKey, normalized, 15);

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
