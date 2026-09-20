// ==============================================================================
// BABATA LENS — NORMALIZATION & VALIDATION SCHEMAS (ZOD)
// ==============================================================================
// Spec: ANTIGRAVITY_IMPLEMENTATION_PROMPT_v2.md (Rule 11)
// Validate all external responses with Zod before normalization.
// If validation fails: log safe diagnostic info & return a typed provider error.
// ==============================================================================

import { z } from "zod";
import {
  PricePoint,
  TokenMarketData,
  WalletBalance,
  Transaction,
  TransactionDetail,
  ContractInfo,
  HolderInfo,
  TickerData,
} from "../providers/interfaces";

// ------------------------------------------------------------------------------
// Address & Network Validation Helpers
// ------------------------------------------------------------------------------

export const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum / EVM address format");

export const SolanaAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address format");

export function isValidCryptoAddress(address: string, network: string): boolean {
  if (network.toLowerCase() === "solana") {
    return SolanaAddressSchema.safeParse(address).success;
  }
  return EthereumAddressSchema.safeParse(address).success;
}

// ------------------------------------------------------------------------------
// External Provider Raw Schemas (for validating raw API responses)
// ------------------------------------------------------------------------------

// CoinGecko Simple Price / Coin Details Raw Schema
export const CoinGeckoMarketRawSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  market_data: z
    .object({
      current_price: z.record(z.number()).optional(),
      price_change_percentage_24h: z.number().nullable().optional(),
      market_cap: z.record(z.number()).optional(),
      total_volume: z.record(z.number()).optional(),
      high_24h: z.record(z.number()).optional(),
      low_24h: z.record(z.number()).optional(),
      circulating_supply: z.number().nullable().optional(),
      total_supply: z.number().nullable().optional(),
    })
    .optional(),
  last_updated: z.string().optional(),
});

// CoinGecko Market Chart Raw Schema
export const CoinGeckoMarketChartRawSchema = z.object({
  prices: z.array(z.tuple([z.number(), z.number()])),
  total_volumes: z.array(z.tuple([z.number(), z.number()])).optional(),
});

// Etherscan Balance Raw Schema
export const EtherscanBalanceRawSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.string(),
});

// Etherscan TxList Raw Schema
export const EtherscanTxRawSchema = z.object({
  blockNumber: z.string(),
  timeStamp: z.string(),
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  isError: z.string().optional(),
});

export const EtherscanTxListRawSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(EtherscanTxRawSchema), z.string()]),
});

// BingX Ticker Raw Schema
export const BingXTickerRawSchema = z.object({
  code: z.number(),
  msg: z.string().optional(),
  data: z
    .object({
      symbol: z.string(),
      lastPrice: z.string().or(z.number()),
      highPrice: z.string().or(z.number()).optional(),
      lowPrice: z.string().or(z.number()).optional(),
      volume: z.string().or(z.number()).optional(),
      priceChangePercent: z.string().or(z.number()).optional(),
      time: z.number().optional(),
    })
    .optional(),
});

// ------------------------------------------------------------------------------
// Normalization Parsers (Converting validated data into Canonical Domain Models)
// ------------------------------------------------------------------------------

export class ProviderValidationError extends Error {
  constructor(public provider: string, public rawError: unknown) {
    super(`[${provider}] External response validation failed.`);
    this.name = "ProviderValidationError";
  }
}

export function normalizeCoinGeckoToken(raw: unknown): TokenMarketData {
  const result = CoinGeckoMarketRawSchema.safeParse(raw);
  if (!result.success) {
    throw new ProviderValidationError("CoinGecko", result.error.format());
  }

  const data = result.data;
  const md = data.market_data;

  return {
    id: data.id,
    symbol: data.symbol.toUpperCase(),
    name: data.name,
    currentPriceUsd: md?.current_price?.["usd"] ?? 0,
    priceChange24hPercent: md?.price_change_percentage_24h ?? 0,
    marketCapUsd: md?.market_cap?.["usd"],
    volume24hUsd: md?.total_volume?.["usd"],
    high24hUsd: md?.high_24h?.["usd"],
    low24hUsd: md?.low_24h?.["usd"],
    circulatingSupply: md?.circulating_supply ?? undefined,
    totalSupply: md?.total_supply ?? undefined,
    lastUpdated: data.last_updated ?? new Date().toISOString(),
  };
}

export function normalizeCoinGeckoChart(raw: unknown): PricePoint[] {
  const result = CoinGeckoMarketChartRawSchema.safeParse(raw);
  if (!result.success) {
    throw new ProviderValidationError("CoinGecko", result.error.format());
  }

  const volMap = new Map<number, number>();
  if (result.data.total_volumes) {
    for (const [time, vol] of result.data.total_volumes) {
      volMap.set(time, vol);
    }
  }

  return result.data.prices.map(([timestamp, price]) => ({
    timestamp,
    price,
    volume: volMap.get(timestamp),
  }));
}

export function normalizeEtherscanBalance(
  raw: unknown,
  address: string,
  network: string
): WalletBalance {
  const parsed = EtherscanBalanceRawSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status !== "1") {
    throw new ProviderValidationError("Etherscan", parsed.error?.format() ?? raw);
  }

  const weiString = parsed.data.result;
  const ethValue = parseFloat(weiString) / 1e18;

  return {
    address,
    network,
    nativeBalance: weiString,
    nativeBalanceFormatted: isNaN(ethValue) ? 0 : ethValue,
    nativeSymbol: "ETH",
    tokens: [],
  };
}

export function normalizeEtherscanTransactions(
  raw: unknown,
  network: string
): Transaction[] {
  const parsed = EtherscanTxListRawSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderValidationError("Etherscan", parsed.error.format());
  }

  if (typeof parsed.data.result === "string" || !Array.isArray(parsed.data.result)) {
    return [];
  }

  return parsed.data.result.map((tx) => {
    const valEth = parseFloat(tx.value) / 1e18;
    return {
      hash: tx.hash,
      network,
      blockNumber: parseInt(tx.blockNumber, 10) || 0,
      timestamp: (parseInt(tx.timeStamp, 10) || 0) * 1000,
      from: tx.from,
      to: tx.to,
      valueFormatted: isNaN(valEth) ? 0 : valEth,
      symbol: "ETH",
      status: tx.isError === "1" ? "failed" : "success",
    };
  });
}

export function normalizeBingXTicker(raw: unknown): TickerData {
  const parsed = BingXTickerRawSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.data) {
    throw new ProviderValidationError("BingX", parsed.error?.format() ?? raw);
  }

  const d = parsed.data.data;
  const lastPrice = typeof d.lastPrice === "number" ? d.lastPrice : parseFloat(d.lastPrice) || 0;
  const high24h = typeof d.highPrice === "number" ? d.highPrice : parseFloat(d.highPrice || "0") || 0;
  const low24h = typeof d.lowPrice === "number" ? d.lowPrice : parseFloat(d.lowPrice || "0") || 0;
  const volume24h = typeof d.volume === "number" ? d.volume : parseFloat(d.volume || "0") || 0;
  const change =
    typeof d.priceChangePercent === "number"
      ? d.priceChangePercent
      : parseFloat(d.priceChangePercent || "0") || 0;

  return {
    symbol: d.symbol,
    lastPrice,
    high24h,
    low24h,
    volume24h,
    priceChangePercent24h: change,
    timestamp: d.time || Date.now(),
  };
}
