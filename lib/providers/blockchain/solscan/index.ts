// ==============================================================================
// BABATA LENS — SOLSCAN BLOCKCHAIN ADAPTER
// ==============================================================================

import {
  BlockchainDataProvider,
  ProviderResult,
  WalletBalance,
  Transaction,
  TransactionDetail,
  ContractInfo,
  Pagination,
  ProviderHealthReport,
} from "../../interfaces";
import { getEnv, hasCredential } from "../../../config/env";
import { SolanaAddressSchema } from "../../../normalize/schemas";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class SolscanProvider implements BlockchainDataProvider {
  id = "solscan";
  name = "Solscan";
  capability = "blockchain" as const;
  supportedNetworks = ["solana"];
  private baseUrl = "https://pro-api.solscan.io/v2.0";

  isConfigured(): boolean {
    return hasCredential("SOLSCAN_API_KEY");
  }

  private getHeaders(): HeadersInit {
    const env = getEnv();
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (env.SOLSCAN_API_KEY) {
      headers["token"] = env.SOLSCAN_API_KEY;
    }
    return headers;
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
      // Test address (Solana Foundation)
      const res = await fetch(
        `${this.baseUrl}/account/detail?address=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`,
        { headers: this.getHeaders() }
      );
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
      } else if (res.status === 401 || res.status === 403) {
        return {
          provider: this.id,
          capability: this.capability,
          status: "invalid",
          latencyMs: latency,
          lastCheckedAt: new Date().toISOString(),
          errorMessage: "Invalid Solscan API token",
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

  async getWalletBalance(
    address: string,
    network: string = "solana"
  ): Promise<ProviderResult<WalletBalance>> {
    const validAddress = SolanaAddressSchema.parse(address);
    const cacheKey = buildCacheKey(this.id, "balance", { address: validAddress });

    const cached = await getCached<WalletBalance>(cacheKey);
    if (cached) {
      return {
        data: cached,
        source: {
          provider: this.id,
          network,
          fetchedAt: new Date().toISOString(),
          cached: true,
        },
      };
    }

    const startTime = Date.now();
    const res = await fetch(`${this.baseUrl}/account/detail?address=${validAddress}`, {
      headers: this.getHeaders(),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Solscan account error (${res.status}): ${res.statusText}`);
    }

    const json = (await res.json()) as {
      data?: {
        lamports?: number;
      };
    };

    const lamports = json.data?.lamports || 0;
    const sol = lamports / 1e9;

    const data: WalletBalance = {
      address: validAddress,
      network: "solana",
      nativeBalance: lamports.toString(),
      nativeBalanceFormatted: sol,
      nativeSymbol: "SOL",
      tokens: [],
    };

    await setCached(cacheKey, data, 30);

    return {
      data,
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }

  async getWalletTransactions(
    address: string,
    network: string = "solana",
    page?: Pagination
  ): Promise<ProviderResult<Transaction[]>> {
    const validAddress = SolanaAddressSchema.parse(address);
    const limit = page?.pageSize || 20;
    const startTime = Date.now();

    const res = await fetch(
      `${this.baseUrl}/account/transactions?address=${validAddress}&page_size=${limit}`,
      { headers: this.getHeaders() }
    );
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Solscan transactions error (${res.status})`);
    }

    const json = (await res.json()) as {
      data?: Array<{
        tx_hash: string;
        slot: number;
        block_time: number;
        fee: number;
        status: number;
      }>;
    };

    const transactions: Transaction[] = (json.data || []).map((t) => ({
      hash: t.tx_hash,
      network: "solana",
      blockNumber: t.slot,
      timestamp: t.block_time * 1000,
      from: validAddress,
      to: "Solana Program",
      valueFormatted: 0,
      symbol: "SOL",
      status: t.status === 1 ? "success" : "failed",
      feeFormatted: t.fee ? t.fee / 1e9 : 0,
    }));

    return {
      data: transactions,
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }

  async getTransactionInformation(
    txHash: string,
    network: string = "solana"
  ): Promise<ProviderResult<TransactionDetail>> {
    const startTime = Date.now();
    const res = await fetch(`${this.baseUrl}/transaction/detail?tx=${txHash}`, {
      headers: this.getHeaders(),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Solscan tx error (${res.status})`);
    }

    const json = (await res.json()) as {
      data?: {
        tx_hash: string;
        slot: number;
        block_time: number;
        fee: number;
        status: number;
        signer: string[];
      };
    };

    const t = json.data;
    if (!t) {
      throw new Error(`Transaction ${txHash} not found on Solscan`);
    }

    return {
      data: {
        hash: t.tx_hash,
        network: "solana",
        blockNumber: t.slot,
        timestamp: (t.block_time || Date.now() / 1000) * 1000,
        from: t.signer?.[0] || "Unknown",
        to: "Solana Program",
        valueFormatted: 0,
        symbol: "SOL",
        status: t.status === 1 ? "success" : "failed",
        feeFormatted: t.fee ? t.fee / 1e9 : 0,
      },
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }

  async getContractInformation(
    address: string,
    network: string = "solana"
  ): Promise<ProviderResult<ContractInfo>> {
    const validAddress = SolanaAddressSchema.parse(address);
    return {
      data: {
        address: validAddress,
        network: "solana",
        name: "Solana Account / Program",
        isVerified: true,
      },
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}
