// ==============================================================================
// BABATA LENS — PROVIDER CONTRACTS & INTERFACES (v2)
// ==============================================================================
// Spec: BABATA_LENS_SPEC_v2.md & ANTIGRAVITY_IMPLEMENTATION_PROMPT_v2.md
// Rules:
// 1. All third-party calls go through provider adapters.
// 2. Every tool-derived factual result carries SourceMeta.
// 3. Never fabricate data when a provider fails.
// 4. Return explicit ProviderResult<T> objects instead of monkey-patching arrays.
// ==============================================================================

export interface SourceMeta {
  provider: string;
  fetchedAt: string;
  network?: string;
  requestId?: string;
  latencyMs?: number;
  cached?: boolean;
}

export interface ProviderResult<T> {
  data: T;
  source: SourceMeta;
}

// ------------------------------------------------------------------------------
// Canonical Domain Models
// ------------------------------------------------------------------------------

export interface PricePoint {
  timestamp: number; // Unix timestamp (ms)
  price: number;
  volume?: number;
}

export interface TokenMarketData {
  id: string;
  symbol: string;
  name: string;
  currentPriceUsd: number;
  priceChange24hPercent: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  high24hUsd?: number;
  low24hUsd?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  lastUpdated: string;
}

export interface TokenQuery {
  symbol?: string;
  id?: string;
  contractAddress?: string;
  network?: string;
}

export type TimeRange = "1d" | "7d" | "30d" | "90d" | "1y" | "all";

export interface TokenHolding {
  symbol: string;
  name: string;
  contractAddress: string;
  balance: string;
  balanceFormatted: number;
  priceUsd?: number;
  valueUsd?: number;
}

export interface WalletBalance {
  address: string;
  network: string;
  nativeBalance: string;
  nativeBalanceFormatted: number;
  nativeSymbol: string;
  totalValueUsd?: number;
  tokens: TokenHolding[];
}

export interface Pagination {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface Transaction {
  hash: string;
  network: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  valueFormatted: number;
  symbol: string;
  status: "success" | "failed" | "pending";
  feeFormatted?: number;
}

export interface TransactionDetail extends Transaction {
  gasUsed?: number;
  gasPriceGwei?: number;
  nonce?: number;
  methodName?: string;
  inputData?: string;
}

export interface ContractInfo {
  address: string;
  network: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  isVerified: boolean;
  creatorAddress?: string;
  deployedTxHash?: string;
  verifiedAt?: string;
  compilerVersion?: string;
}

export interface HolderInfo {
  address: string;
  balance: string;
  balanceFormatted: number;
  percentage: number;
}

export interface AnalyticsQuery {
  queryId?: string;
  sql?: string;
  parameters?: Record<string, string | number | boolean>;
}

export interface AnalyticsResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs?: number;
}

export interface TickerData {
  symbol: string;
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  priceChangePercent24h: number;
  timestamp: number;
}

// ------------------------------------------------------------------------------
// Babata AI & Tool Calling Interfaces
// ------------------------------------------------------------------------------

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  source?: SourceMeta;
  error?: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCallRequest[];
  toolResults?: ToolResult[];
}

export interface AgentInput {
  messages: AgentMessage[];
  availableTools?: string[];
  modelTier?: "simple" | "standard" | "complex";
}

export interface AgentOutput {
  text: string;
  toolCalls?: ToolCallRequest[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  source: SourceMeta;
}

// ------------------------------------------------------------------------------
// Provider Contracts
// ------------------------------------------------------------------------------

export type ProviderHealthStatus =
  | "configured"
  | "connected"
  | "degraded"
  | "rate_limited"
  | "invalid"
  | "unavailable"
  | "disabled";

export interface ProviderHealthReport {
  provider: string;
  capability: string;
  status: ProviderHealthStatus;
  lastSuccessAt?: string;
  latencyMs?: number;
  lastCheckedAt: string;
  errorMessage?: string;
}

export interface BaseProvider {
  id: string;
  name: string;
  capability: "ai" | "market" | "blockchain" | "token" | "analytics" | "exchange";
  isConfigured(): boolean;
  checkHealth(): Promise<ProviderHealthReport>;
}

export interface AIProvider extends BaseProvider {
  capability: "ai";
  generateResponse(input: AgentInput): Promise<AgentOutput>;
}

export interface MarketDataProvider extends BaseProvider {
  capability: "market";
  getTokenMarketData(query: TokenQuery): Promise<ProviderResult<TokenMarketData>>;
  getMarketHistory(query: TokenQuery, range: TimeRange): Promise<ProviderResult<PricePoint[]>>;
}

export interface BlockchainDataProvider extends BaseProvider {
  capability: "blockchain";
  supportedNetworks: string[];
  getWalletBalance(address: string, network: string): Promise<ProviderResult<WalletBalance>>;
  getWalletTransactions(
    address: string,
    network: string,
    page?: Pagination
  ): Promise<ProviderResult<Transaction[]>>;
  getTransactionInformation(
    txHash: string,
    network: string
  ): Promise<ProviderResult<TransactionDetail>>;
  getContractInformation(
    address: string,
    network: string
  ): Promise<ProviderResult<ContractInfo>>;
}

export interface TokenDataProvider extends BaseProvider {
  capability: "token";
  supportedNetworks: string[];
  getTokenHolders(address: string, network: string): Promise<ProviderResult<HolderInfo[]>>;
}

export interface AnalyticsProvider extends BaseProvider {
  capability: "analytics";
  runAnalyticsQuery(query: AnalyticsQuery): Promise<ProviderResult<AnalyticsResult>>;
}

export interface ExchangeDataProvider extends BaseProvider {
  capability: "exchange";
  getExchangeTicker(symbol: string): Promise<ProviderResult<TickerData>>;
}
