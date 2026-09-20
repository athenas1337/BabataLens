// ==============================================================================
// BABATA LENS — ALCHEMY BLOCKCHAIN ADAPTER
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
import { EthereumAddressSchema } from "../../../normalize/schemas";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class AlchemyProvider implements BlockchainDataProvider {
  id = "alchemy";
  name = "Alchemy";
  capability = "blockchain" as const;
  supportedNetworks = ["ethereum", "polygon", "arbitrum", "optimism"];

  isConfigured(): boolean {
    return hasCredential("ALCHEMY_API_KEY");
  }

  private getRpcUrl(network: string = "ethereum"): string {
    const env = getEnv();
    const map: Record<string, string> = {
      ethereum: "https://eth-mainnet.g.alchemy.com/v2",
      polygon: "https://polygon-mainnet.g.alchemy.com/v2",
      arbitrum: "https://arb-mainnet.g.alchemy.com/v2",
      optimism: "https://opt-mainnet.g.alchemy.com/v2",
    };
    const base = map[network.toLowerCase()] || map["ethereum"];
    return `${base}/${env.ALCHEMY_API_KEY}`;
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
      const res = await fetch(this.getRpcUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
      });

      const latency = Date.now() - startTime;
      if (res.ok) {
        const json = await res.json();
        if (json.result) {
          return {
            provider: this.id,
            capability: this.capability,
            status: "connected",
            lastSuccessAt: new Date().toISOString(),
            latencyMs: latency,
            lastCheckedAt: new Date().toISOString(),
          };
        }
      }
      return {
        provider: this.id,
        capability: this.capability,
        status: "degraded",
        latencyMs: latency,
        lastCheckedAt: new Date().toISOString(),
      };
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
    network: string = "ethereum"
  ): Promise<ProviderResult<WalletBalance>> {
    const validAddress = EthereumAddressSchema.parse(address);
    const cacheKey = buildCacheKey(this.id, "balance", { address: validAddress, network });

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
    const res = await fetch(this.getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [validAddress, "latest"],
      }),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Alchemy getBalance error (${res.status})`);
    }

    const json = await res.json();
    const hexBal = json.result || "0x0";
    const wei = BigInt(hexBal);
    const ethFormatted = Number(wei) / 1e18;

    const data: WalletBalance = {
      address: validAddress,
      network,
      nativeBalance: wei.toString(),
      nativeBalanceFormatted: ethFormatted,
      nativeSymbol: network.toUpperCase() === "POLYGON" ? "MATIC" : "ETH",
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
    network: string = "ethereum",
    page?: Pagination
  ): Promise<ProviderResult<Transaction[]>> {
    const validAddress = EthereumAddressSchema.parse(address);
    const startTime = Date.now();

    // Query Alchemy Asset Transfers
    const res = await fetch(this.getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: validAddress,
            category: ["external", "erc20"],
            maxCount: "0x14",
          },
        ],
      }),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Alchemy transfers error (${res.status})`);
    }

    const json = await res.json();
    const transfers = (json.result?.transfers || []) as Array<{
      hash: string;
      blockNum: string;
      from: string;
      to: string;
      value: number;
      asset: string;
    }>;

    const transactions: Transaction[] = transfers.map((t) => ({
      hash: t.hash,
      network,
      blockNumber: parseInt(t.blockNum, 16) || 0,
      timestamp: Date.now(),
      from: t.from,
      to: t.to,
      valueFormatted: t.value || 0,
      symbol: t.asset || "ETH",
      status: "success",
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
    network: string = "ethereum"
  ): Promise<ProviderResult<TransactionDetail>> {
    const startTime = Date.now();
    const res = await fetch(this.getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionByHash",
        params: [txHash],
      }),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Alchemy getTx error (${res.status})`);
    }

    const json = await res.json();
    const tx = json.result;
    if (!tx) {
      throw new Error(`Transaction ${txHash} not found on Alchemy`);
    }

    const valEth = parseInt(tx.value, 16) / 1e18;
    return {
      data: {
        hash: tx.hash,
        network,
        blockNumber: parseInt(tx.blockNumber, 16) || 0,
        timestamp: Date.now(),
        from: tx.from,
        to: tx.to,
        valueFormatted: isNaN(valEth) ? 0 : valEth,
        symbol: "ETH",
        status: "success",
        gasUsed: parseInt(tx.gas, 16) || 0,
        gasPriceGwei: (parseInt(tx.gasPrice, 16) || 0) / 1e9,
        nonce: parseInt(tx.nonce, 16) || 0,
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
    network: string = "ethereum"
  ): Promise<ProviderResult<ContractInfo>> {
    const validAddress = EthereumAddressSchema.parse(address);
    const startTime = Date.now();

    // Check code at address to determine if contract
    const res = await fetch(this.getRpcUrl(network), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getCode",
        params: [validAddress, "latest"],
      }),
    });
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Alchemy eth_getCode error (${res.status})`);
    }

    const json = await res.json();
    const code = json.result || "0x";
    const isContract = code !== "0x" && code !== "0x0";

    return {
      data: {
        address: validAddress,
        network,
        name: isContract ? "Verified Smart Contract" : "EOA Account",
        isVerified: isContract,
      },
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }
}
