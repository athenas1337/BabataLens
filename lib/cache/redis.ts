// ==============================================================================
// BABATA LENS — CACHING LAYER
// ==============================================================================
// Implements Redis hot cache with in-memory fallback.
// Key format: provider:capability:normalized-params-hash
// Never caches secrets.
// ==============================================================================

import { getEnv } from "../config/env";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory fallback cache
const memoryCache = new Map<string, CacheEntry<unknown>>();

export function buildCacheKey(
  provider: string,
  capability: string,
  params: Record<string, unknown>
): string {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((k) => `${k}=${String(params[k])}`).join("&");
  return `babata:${provider}:${capability}:${serialized}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  const env = getEnv();

  // Try Upstash Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      if (res.ok) {
        const json = (await res.json()) as { result: string | null };
        if (json.result) {
          return JSON.parse(json.result) as T;
        }
      }
    } catch {
      // Fall through to memory cache
    }
  }

  // Memory cache fallback
  const entry = memoryCache.get(key);
  if (entry) {
    if (Date.now() < entry.expiresAt) {
      return entry.data as T;
    }
    memoryCache.delete(key);
  }

  return null;
}

export async function setCached<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  const env = getEnv();

  // Save to Upstash Redis if configured
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      await fetch(
        `${env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          },
          body: JSON.stringify(data),
        }
      );
    } catch {
      // Fall through
    }
  }

  // Always save in memory fallback
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
