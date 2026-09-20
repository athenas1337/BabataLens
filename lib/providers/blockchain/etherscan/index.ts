// ==============================================================================
// BABATA LENS — ETHERSCAN BLOCKCHAIN ADAPTER
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
import {
  normalizeEtherscanBalance,
  normalizeEtherscanTransactions,
  EthereumAddressSchema,
} from "../../../normalize/schemas";
import { buildCacheKey, getCached, setCached } from "../../../cache/redis";

export class EtherscanProvider implements BlockchainDataProvider {
  id = "etherscan";
  name = "Etherscan";
  capability = "blockchain" as const;
  supportedNetworks = ["ethereum", "sepolia", "goerli"];
  private baseUrl = "https://api.etherscan.io/api";

  isConfigured(): boolean {
    return hasCredential("ETHERSCAN_API_KEY");
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
      // Probe with vitalik.eth address
      const res = await fetch(
        `${this.baseUrl}?module=account&action=balance&address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&tag=latest&apikey=${env.ETHERSCAN_API_KEY}`
      );
      const latency = Date.now() - startTime;
      if (res.ok) {
        const json = await res.json();
        if (json.status === "1") {
          return {
            provider: this.id,
            capability: this.capability,
            status: "connected",
            lastSuccessAt: new Date().toISOString(),
            latencyMs: latency,
            lastCheckedAt: new Date().toISOString(),
          };
        } else if (json.message === "NOTOK" && json.result?.includes("Invalid API Key")) {
          return {
            provider: this.id,
            capability: this.capability,
            status: "invalid",
            latencyMs: latency,
            lastCheckedAt: new Date().toISOString(),
            errorMessage: json.result,
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
    // Validate EVM address
    const validAddress = EthereumAddressSchema.parse(address);
    const env = getEnv();
    if (!env.ETHERSCAN_API_KEY) {
      throw new Error("[Etherscan] Missing ETHERSCAN_API_KEY");
    }

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
    const url = `${this.baseUrl}?module=account&action=balance&address=${validAddress}&tag=latest&apikey=${env.ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Etherscan API error (${res.status}): ${res.statusText}`);
    }

    const raw = await res.json();
    const normalized = normalizeEtherscanBalance(raw, validAddress, network);

    // Cache balance for 30s
    await setCached(cacheKey, normalized, 30);

    return {
      data: normalized,
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
    const env = getEnv();
    if (!env.ETHERSCAN_API_KEY) {
      throw new Error("[Etherscan] Missing ETHERSCAN_API_KEY");
    }

    const pageNum = page?.page || 1;
    const offset = page?.pageSize || 20;
    const cacheKey = buildCacheKey(this.id, "txs", { address: validAddress, pageNum, offset });

    const cached = await getCached<Transaction[]>(cacheKey);
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
    const url = `${this.baseUrl}?module=account&action=txlist&address=${validAddress}&startblock=0&endblock=99999999&page=${pageNum}&offset=${offset}&sort=desc&apikey=${env.ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Etherscan txlist error (${res.status}): ${res.statusText}`);
    }

    const raw = await res.json();
    const normalized = normalizeEtherscanTransactions(raw, network);

    await setCached(cacheKey, normalized, 60);

    return {
      data: normalized,
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
    const env = getEnv();
    if (!env.ETHERSCAN_API_KEY) {
      throw new Error("[Etherscan] Missing ETHERSCAN_API_KEY");
    }

    const startTime = Date.now();
    const url = `${this.baseUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${env.ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Etherscan tx detail error (${res.status})`);
    }

    const raw = await res.json();
    const tx = raw.result;
    if (!tx) {
      throw new Error(`Transaction ${txHash} not found`);
    }

    const valEth = parseInt(tx.value, 16) / 1e18;
    const detail: TransactionDetail = {
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
    };

    return {
      data: detail,
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
    const env = getEnv();
    if (!env.ETHERSCAN_API_KEY) {
      throw new Error("[Etherscan] Missing ETHERSCAN_API_KEY");
    }

    const startTime = Date.now();
    const url = `${this.baseUrl}?module=contract&action=getsourcecode&address=${validAddress}&apikey=${env.ETHERSCAN_API_KEY}`;
    const res = await fetch(url);
    const latency = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`Etherscan contract error (${res.status})`);
    }

    const raw = await res.json();
    const item = raw.result?.[0];

    const isVerified = Boolean(item && item.SourceCode && item.SourceCode.length > 0);
    const contractInfo: ContractInfo = {
      address: validAddress,
      network,
      name: item?.ContractName || "Unknown Contract",
      compilerVersion: item?.CompilerVersion,
      isVerified,
    };

    return {
      data: contractInfo,
      source: {
        provider: this.id,
        network,
        fetchedAt: new Date().toISOString(),
        latencyMs: latency,
      },
    };
  }
}
