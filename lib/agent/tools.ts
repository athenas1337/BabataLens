// ==============================================================================
// BABATA LENS — ALLOWLISTED AGENT TOOLS
// ==============================================================================
// Non-negotiable rules:
// 1. Strict typed schemas (Zod).
// 2. NO arbitrary URL fetching.
// 3. NO arbitrary HTTP methods or code execution.
// 4. Return canonical ProviderResult with SourceMeta.
// ==============================================================================

import { z } from "zod";
import { providerRegistry } from "../providers/registry";
import { ToolResult } from "../providers/interfaces";
import { EthereumAddressSchema, SolanaAddressSchema } from "../normalize/schemas";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<ToolResult>;
}

export const tools: Record<string, ToolDefinition> = {
  get_market_data: {
    name: "get_market_data",
    description: "Fetches current token market price, 24h change, volume, and market cap.",
    parameters: z.object({
      symbol: z.string().describe("Token symbol, e.g. BTC, ETH, SOL, NEAR"),
    }),
    execute: async (args: { symbol: string }) => {
      const provider = providerRegistry.getMarketProvider();
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_market_data",
          result: null,
          error: "No market provider is configured or available.",
        };
      }
      try {
        const result = await provider.getTokenMarketData({ symbol: args.symbol });
        return {
          toolCallId: "",
          name: "get_market_data",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_market_data",
          result: null,
          error: err instanceof Error ? err.message : "Failed to fetch market data",
        };
      }
    },
  },

  get_market_history: {
    name: "get_market_history",
    description: "Fetches historical price chart points for a token.",
    parameters: z.object({
      symbol: z.string().describe("Token symbol, e.g. BTC, ETH"),
      range: z.enum(["1d", "7d", "30d", "90d", "1y", "all"]).default("7d"),
    }),
    execute: async (args: { symbol: string; range: "1d" | "7d" | "30d" | "90d" | "1y" | "all" }) => {
      const provider = providerRegistry.getMarketProvider();
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_market_history",
          result: null,
          error: "No market provider is configured.",
        };
      }
      try {
        const result = await provider.getMarketHistory({ symbol: args.symbol }, args.range);
        return {
          toolCallId: "",
          name: "get_market_history",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_market_history",
          result: null,
          error: err instanceof Error ? err.message : "Failed to fetch market history",
        };
      }
    },
  },

  get_wallet_balance: {
    name: "get_wallet_balance",
    description: "Fetches the native cryptocurrency balance for a validated wallet address.",
    parameters: z.object({
      address: z.string().describe("Crypto wallet address (0x... for EVM, base58 for Solana)"),
      network: z.enum(["ethereum", "solana", "polygon", "arbitrum"]).default("ethereum"),
    }),
    execute: async (args: { address: string; network: string }) => {
      const provider = providerRegistry.getBlockchainProvider(args.network);
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_wallet_balance",
          result: null,
          error: `No blockchain provider configured for ${args.network}.`,
        };
      }
      try {
        const result = await provider.getWalletBalance(args.address, args.network);
        return {
          toolCallId: "",
          name: "get_wallet_balance",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_wallet_balance",
          result: null,
          error: err instanceof Error ? err.message : "Failed to fetch wallet balance",
        };
      }
    },
  },

  get_wallet_transactions: {
    name: "get_wallet_transactions",
    description: "Fetches recent blockchain transactions for an address.",
    parameters: z.object({
      address: z.string().describe("Crypto wallet address"),
      network: z.enum(["ethereum", "solana", "polygon"]).default("ethereum"),
      limit: z.number().optional().default(10),
    }),
    execute: async (args: { address: string; network: string; limit?: number }) => {
      const provider = providerRegistry.getBlockchainProvider(args.network);
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_wallet_transactions",
          result: null,
          error: `No blockchain provider available for ${args.network}.`,
        };
      }
      try {
        const result = await provider.getWalletTransactions(args.address, args.network, {
          pageSize: args.limit,
        });
        return {
          toolCallId: "",
          name: "get_wallet_transactions",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_wallet_transactions",
          result: null,
          error: err instanceof Error ? err.message : "Failed to fetch transactions",
        };
      }
    },
  },

  get_transaction: {
    name: "get_transaction",
    description: "Fetches detailed information for a specific transaction hash.",
    parameters: z.object({
      txHash: z.string().describe("Transaction hash"),
      network: z.enum(["ethereum", "solana"]).default("ethereum"),
    }),
    execute: async (args: { txHash: string; network: string }) => {
      const provider = providerRegistry.getBlockchainProvider(args.network);
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_transaction",
          result: null,
          error: `No blockchain provider configured for ${args.network}.`,
        };
      }
      try {
        const result = await provider.getTransactionInformation(args.txHash, args.network);
        return {
          toolCallId: "",
          name: "get_transaction",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_transaction",
          result: null,
          error: err instanceof Error ? err.message : "Failed to inspect transaction",
        };
      }
    },
  },

  get_contract_information: {
    name: "get_contract_information",
    description: "Fetches verification and metadata about a smart contract.",
    parameters: z.object({
      address: z.string().describe("Contract address"),
      network: z.enum(["ethereum", "solana"]).default("ethereum"),
    }),
    execute: async (args: { address: string; network: string }) => {
      const provider = providerRegistry.getBlockchainProvider(args.network);
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_contract_information",
          result: null,
          error: "No blockchain provider available.",
        };
      }
      try {
        const result = await provider.getContractInformation(args.address, args.network);
        return {
          toolCallId: "",
          name: "get_contract_information",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_contract_information",
          result: null,
          error: err instanceof Error ? err.message : "Failed to inspect contract",
        };
      }
    },
  },

  compare_market_sources: {
    name: "compare_market_sources",
    description: "Compares market data for a token between CoinGecko and CoinMarketCap without averaging.",
    parameters: z.object({
      symbol: z.string().describe("Token symbol to cross-examine"),
    }),
    execute: async (args: { symbol: string }) => {
      const cg = providerRegistry.getMarketProvider("coingecko");
      const cmc = providerRegistry.getMarketProvider("coinmarketcap");

      const results: Record<string, unknown> = {};

      if (cg) {
        try {
          const res = await cg.getTokenMarketData({ symbol: args.symbol });
          results.coingecko = { data: res.data, source: res.source };
        } catch (e) {
          results.coingecko = { error: e instanceof Error ? e.message : "Failed" };
        }
      }

      if (cmc && cmc.isConfigured()) {
        try {
          const res = await cmc.getTokenMarketData({ symbol: args.symbol });
          results.coinmarketcap = { data: res.data, source: res.source };
        } catch (e) {
          results.coinmarketcap = { error: e instanceof Error ? e.message : "Failed" };
        }
      }

      return {
        toolCallId: "",
        name: "compare_market_sources",
        result: results,
        source: {
          provider: "babata-cross-reference",
          fetchedAt: new Date().toISOString(),
        },
      };
    },
  },

  get_exchange_ticker: {
    name: "get_exchange_ticker",
    description: "Fetches real-time price and order-book ticker info from BingX exchange.",
    parameters: z.object({
      symbol: z.string().describe("Exchange symbol, e.g. BTC, ETH, SOL"),
    }),
    execute: async (args: { symbol: string }) => {
      const provider = providerRegistry.getExchangeProvider();
      if (!provider) {
        return {
          toolCallId: "",
          name: "get_exchange_ticker",
          result: null,
          error: "BingX exchange provider is not configured.",
        };
      }
      try {
        const result = await provider.getExchangeTicker(args.symbol);
        return {
          toolCallId: "",
          name: "get_exchange_ticker",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "get_exchange_ticker",
          result: null,
          error: err instanceof Error ? err.message : "Failed to fetch ticker",
        };
      }
    },
  },

  run_analytics_query: {
    name: "run_analytics_query",
    description: "Executes or retrieves analytics metrics from Dune Analytics.",
    parameters: z.object({
      queryId: z.string().describe("Dune Analytics query ID"),
    }),
    execute: async (args: { queryId: string }) => {
      const provider = providerRegistry.getAnalyticsProvider();
      if (!provider || !provider.isConfigured()) {
        return {
          toolCallId: "",
          name: "run_analytics_query",
          result: null,
          error: "Dune Analytics provider is not configured.",
        };
      }
      try {
        const result = await provider.runAnalyticsQuery({ queryId: args.queryId });
        return {
          toolCallId: "",
          name: "run_analytics_query",
          result: result.data,
          source: result.source,
        };
      } catch (err: unknown) {
        return {
          toolCallId: "",
          name: "run_analytics_query",
          result: null,
          error: err instanceof Error ? err.message : "Failed to execute analytics query",
        };
      }
    },
  },
};
