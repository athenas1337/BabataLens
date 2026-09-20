// ==============================================================================
// BABATA LENS — DUNE ANALYTICS ADAPTER
// ==============================================================================

import {
  AnalyticsProvider,
  ProviderResult,
  AnalyticsQuery,
  AnalyticsResult,
  ProviderHealthReport,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class DuneProvider implements AnalyticsProvider {
  id = "dune";
  name = "Dune Analytics";
  capability = "analytics" as const;
  private baseUrl = "https://api.dune.com/api/v1";

  isConfigured(): boolean {
    return hasCredential("DUNE_API_KEY");
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
      // Probe with standard health / public query ping
      const res = await fetch(`${this.baseUrl}/query/1234/results`, {
        headers: {
          "X-DUNE-API-KEY": env.DUNE_API_KEY || "",
        },
      });
      const latency = Date.now() - startTime;
      if (res.status === 200 || res.status === 404) {
        // 404 on dummy query ID still confirms valid authenticated API contact
        return {
          provider: this.id,
          capability: this.capability,
          status: "connected",
          lastSuccessAt: new Date().toISOString(),
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
        };
      } else if (res.status === 401 || res.status === 403) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "invalid",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "Invalid Dune API Key",
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

  async runAnalyticsQuery(query: AnalyticsQuery): Promise<ProviderResult<AnalyticsResult>> {
    const env = getEnv();
    if (!env.DUNE_API_KEY) {
      throw new Error("[Dune] Missing DUNE_API_KEY");
    }

    const queryId = query.queryId || "1215383"; // Default popular dex query if unspecified
    const cacheKey = buildCacheKey(this.id, "query", { queryId });

    const cached = await getCached<AnalyticsResult>(cacheKey);
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
    const res = await fetch(`${this.baseUrl}/query/${queryId}/results`, {
      headers: {
        "X-DUNE-API-KEY": env.DUNE_API_KEY,
      },
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Dune query execution error (${res.status}): ${res.statusText}`);
    }

    const json = (await res.json()) as {
      result?: {
        rows?: Record<string, unknown>[];
        metadata?: {
          column_names?: string[];
          execution_time_millis?: number;
        };
      };
    };

    const rows = json.result?.rows || [];
    const columns = json.result?.metadata?.column_names || (rows[0] ? Object.keys(rows[0]) : []);

    const result: AnalyticsResult = {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs: json.result?.metadata?.execution_time_millis || latency,
    };

    // Cache analytics results for 10 minutes
    await setCached(cacheKey, result, 600);

    return {
      data: result,
      source: {
        provider: this.id,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }
}
