// ==============================================================================
// BABATA LENS — SAFE ENVIRONMENT CONFIGURATION
// ==============================================================================
// Non-negotiable security rules:
// 1. Server-side only. Never expose secrets to client code or NEXT_PUBLIC_*
// 2. Application boots cleanly even when disabled/optional providers lack keys.
// 3. Redacts secrets safely from logs or diagnostics.
// ==============================================================================

import { z } from "zod";

const EnvSchema = z.object({
  // AI Keys
  GOOGLE_AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  // Market Keys
  COINGECKO_API_KEY: z.string().optional(),
  COINMARKETCAP_API_KEY: z.string().optional(),

  // Blockchain Keys
  ETHERSCAN_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  SOLSCAN_API_KEY: z.string().optional(),

  // Analytics
  DUNE_API_KEY: z.string().optional(),

  // Exchange
  BINGX_API_KEY: z.string().optional(),
  BINGX_API_SECRET: z.string().optional(),

  // Database & Cache
  DATABASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Auth
  AUTH_SECRET: z.string().optional(),
  AUTH_URL: z.string().optional().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let _env: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (_env) return _env;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("[Babata Config] Warning: Non-fatal env validation warnings:", parsed.error.format());
    _env = (process.env as unknown) as EnvConfig;
  } else {
    _env = parsed.data;
  }
  return _env;
}

/**
 * Checks if a given provider key is configured and non-empty.
 */
export function hasCredential(keyName: keyof EnvConfig): boolean {
  const env = getEnv();
  const val = env[keyName];
  return typeof val === "string" && val.trim().length > 0;
}

/**
 * Sanitizes an object or string for logging, masking any sensitive tokens or API keys.
 */
export function redactSecret(value: unknown): unknown {
  if (!value) return value;
  if (typeof value === "string") {
    // Redact API keys with known prefixes or long high-entropy alphanumeric strings
    const isTokenPattern =
      value.startsWith("sk-") ||
      value.startsWith("ghp_") ||
      value.startsWith("bearer ") ||
      value.startsWith("eyJ") ||
      (/^[A-Za-z0-9_-]{20,}$/.test(value) && /\d/.test(value) && /[a-zA-Z]/.test(value));

    if (isTokenPattern && value.length >= 20) {
      return `${value.slice(0, 4)}...***...${value.slice(-4)}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSecret);
  }
  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("password")
      ) {
        redacted[k] = "[REDACTED]";
      } else {
        redacted[k] = redactSecret(v);
      }
    }
    return redacted;
  }
  return value;
}
