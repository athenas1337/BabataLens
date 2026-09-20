// ==============================================================================
// BABATA LENS — PROVIDER REGISTRY & ORCHESTRATION
// ==============================================================================
// Spec: BABATA_LENS_SPEC_v2.md (Section C.3) & ANTIGRAVITY_IMPLEMENTATION_PROMPT_v2.md
// Rules:
// 1. Manages capability lookup, provider priority, enable/disable status.
// 2. Secrets themselves never belong in the registry.
// 3. Application boots even if 0 providers are configured.
// 4. Provides safe health checks without exposing sensitive data.
// ==============================================================================

import {
  BaseProvider,
  AIProvider,
  MarketDataProvider,
  BlockchainDataProvider,
  ExchangeDataProvider,
  AnalyticsProvider,
  ProviderHealthReport,
} from "./interfaces";

import { GoogleAIProvider } from "./ai/google";
import { AnthropicAIProvider } from "./ai/anthropic";
import { OpenRouterAIProvider } from "./ai/openrouter";
import { CoinGeckoProvider } from "./market/coingecko";
import { CoinMarketCapProvider } from "./market/coinmarketcap";
import { EtherscanProvider } from "./blockchain/etherscan";
import { AlchemyProvider } from "./blockchain/alchemy";
import { SolscanProvider } from "./blockchain/solscan";
import { BingXProvider } from "./exchange/bingx";
import { DuneProvider } from "./analytics/dune";

export interface ProviderManifest {
  id: string;
  name: string;
  capability: "ai" | "market" | "blockchain" | "exchange" | "analytics";
  supportedNetworks?: string[];
  priority: number; // lower number = higher priority
  requiredEnvVars: string[];
  instance: BaseProvider;
}

class ProviderRegistry {
  private providers: Map<string, ProviderManifest> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // AI Providers
    this.register({
      id: "google",
      name: "Google AI (Gemini)",
      capability: "ai",
      priority: 1,
      requiredEnvVars: ["GOOGLE_AI_API_KEY"],
      instance: new GoogleAIProvider(),
    });

    this.register({
      id: "anthropic",
      name: "Anthropic Claude",
      capability: "ai",
      priority: 2,
      requiredEnvVars: ["ANTHROPIC_API_KEY"],
      instance: new AnthropicAIProvider(),
    });

    this.register({
      id: "openrouter",
      name: "OpenRouter",
      capability: "ai",
      priority: 3,
      requiredEnvVars: ["OPENROUTER_API_KEY"],
      instance: new OpenRouterAIProvider(),
    });

    // Market Providers
    this.register({
      id: "coingecko",
      name: "CoinGecko",
      capability: "market",
      priority: 1,
      requiredEnvVars: [], // Can run free tier or with demo key
      instance: new CoinGeckoProvider(),
    });

    this.register({
      id: "coinmarketcap",
      name: "CoinMarketCap",
      capability: "market",
      priority: 2,
      requiredEnvVars: ["COINMARKETCAP_API_KEY"],
      instance: new CoinMarketCapProvider(),
    });

    // Blockchain Providers
    this.register({
      id: "etherscan",
      name: "Etherscan",
      capability: "blockchain",
      supportedNetworks: ["ethereum", "sepolia"],
      priority: 1,
      requiredEnvVars: ["ETHERSCAN_API_KEY"],
      instance: new EtherscanProvider(),
    });

    this.register({
      id: "alchemy",
      name: "Alchemy",
      capability: "blockchain",
      supportedNetworks: ["ethereum", "polygon", "arbitrum", "optimism"],
      priority: 2,
      requiredEnvVars: ["ALCHEMY_API_KEY"],
      instance: new AlchemyProvider(),
    });

    this.register({
      id: "solscan",
      name: "Solscan",
      capability: "blockchain",
      supportedNetworks: ["solana"],
      priority: 1,
      requiredEnvVars: ["SOLSCAN_API_KEY"],
      instance: new SolscanProvider(),
    });

    // Exchange Providers
    this.register({
      id: "bingx",
      name: "BingX",
      capability: "exchange",
      priority: 1,
      requiredEnvVars: ["BINGX_API_KEY"],
      instance: new BingXProvider(),
    });

    // Analytics Providers
    this.register({
      id: "dune",
      name: "Dune Analytics",
      capability: "analytics",
      priority: 1,
      requiredEnvVars: ["DUNE_API_KEY"],
      instance: new DuneProvider(),
    });
  }

  public register(manifest: ProviderManifest): void {
    this.providers.set(manifest.id, manifest);
  }

  public getProviderManifest(id: string): ProviderManifest | undefined {
    return this.providers.get(id);
  }

  public getAllManifests(): ProviderManifest[] {
    return Array.from(this.providers.values());
  }

  /**
   * Retrieves the active AI provider, honoring configuration and priority order.
   */
  public getAIProvider(preferredId?: string): AIProvider | null {
    if (preferredId) {
      const manifest = this.providers.get(preferredId);
      if (manifest && manifest.capability === "ai" && manifest.instance.isConfigured()) {
        return manifest.instance as AIProvider;
      }
    }

    const aiProviders = Array.from(this.providers.values())
      .filter((m) => m.capability === "ai")
      .sort((a, b) => a.priority - b.priority);

    for (const m of aiProviders) {
      if (m.instance.isConfigured()) {
        return m.instance as AIProvider;
      }
    }

    return null;
  }

  /**
   * Retrieves active market provider.
   */
  public getMarketProvider(preferredId?: string): MarketDataProvider | null {
    if (preferredId) {
      const m = this.providers.get(preferredId);
      if (m && m.capability === "market" && m.instance.isConfigured()) {
        return m.instance as MarketDataProvider;
      }
    }

    const marketProviders = Array.from(this.providers.values())
      .filter((m) => m.capability === "market")
      .sort((a, b) => a.priority - b.priority);

    for (const m of marketProviders) {
      if (m.instance.isConfigured()) {
        return m.instance as MarketDataProvider;
      }
    }

    return null;
  }

  /**
   * Retrieves active blockchain provider for a given network (e.g. "ethereum", "solana").
   */
  public getBlockchainProvider(network: string = "ethereum"): BlockchainDataProvider | null {
    const netLower = network.toLowerCase();
    const chainProviders = Array.from(this.providers.values())
      .filter((m) => m.capability === "blockchain")
      .sort((a, b) => a.priority - b.priority);

    for (const m of chainProviders) {
      const instance = m.instance as BlockchainDataProvider;
      if (
        instance.supportedNetworks.map((n) => n.toLowerCase()).includes(netLower) &&
        instance.isConfigured()
      ) {
        return instance;
      }
    }

    // Return first configured blockchain provider as fallback
    for (const m of chainProviders) {
      if (m.instance.isConfigured()) {
        return m.instance as BlockchainDataProvider;
      }
    }

    return null;
  }

  /**
   * Retrieves active exchange provider.
   */
  public getExchangeProvider(): ExchangeDataProvider | null {
    const m = this.providers.get("bingx");
    return m ? (m.instance as ExchangeDataProvider) : null;
  }

  /**
   * Retrieves active analytics provider.
   */
  public getAnalyticsProvider(): AnalyticsProvider | null {
    const m = this.providers.get("dune");
    return m ? (m.instance as AnalyticsProvider) : null;
  }

  /**
   * Performs non-secret health checks across all registered providers.
   */
  public async checkAllHealth(): Promise<ProviderHealthReport[]> {
    const reports: ProviderHealthReport[] = [];
    for (const manifest of Array.from(this.providers.values())) {
      try {
        const report = await manifest.instance.checkHealth();
        reports.push(report);
      } catch (err) {
        reports.push({
          provider: manifest.id,
          capability: manifest.capability,
          status: "unavailable",
          lastCheckedAt: new Date().toISOString(),
          errorMessage: err instanceof Error ? err.message : "Health check failed",
        });
      }
    }
    return reports;
  }
}

// Singleton registry instance
export const providerRegistry = new ProviderRegistry();
