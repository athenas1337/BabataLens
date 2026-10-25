"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, KeyRound, Info, ArrowDownLeft, ArrowUpRight, X, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

type View = "holdings" | "netflows" | "flows";

interface HoldingRow {
  chain: string;
  tokenAddress: string;
  tokenSymbol: string;
  sectors?: string[];
  valueUsd: number;
  balance24hPercentChange?: number;
  holdersCount?: number;
  shareOfHoldingsPercent?: number;
  marketCapUsd?: number;
}

interface NetflowRow {
  chain: string;
  tokenAddress: string;
  tokenSymbol?: string;
  netflowUsd: number;
  netflow24hChangePercent?: number;
  tradersCount?: number;
}

interface SmartMoneyResponse {
  configured: boolean;
  view: View;
  data: (HoldingRow | NetflowRow)[];
  provider?: string;
  message?: string;
  chains?: string[];
  source?: { provider: string; fetchedAt: string };
  /** True when the numbers are measured on-chain, not Nansen-labelled cohorts. */
  proxy?: boolean;
  unlock?: { envVar: string; label: string; note: string };
}

const CHAINS = [
  { id: "", label: "All chains" },
  { id: "ethereum", label: "Ethereum" },
  { id: "solana", label: "Solana" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "polygon", label: "Polygon" },
  { id: "bnb", label: "BNB" },
];

/** Live flows are served by Blockscout explorers that permit API access. */
const FLOW_CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "optimism", label: "Optimism" },
];
const FLOW_HOSTS: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  optimism: "https://explorer.optimism.io",
};

interface FlowRow {
  chain: string;
  walletAddress: string;
  walletLabel: string;
  direction: "in" | "out";
  tokenSymbol: string;
  tokenName?: string;
  amount: number;
  valueUsd?: number;
  counterparty: string;
  txHash: string;
  timestamp: string;
}

interface FlowsResponse {
  flows?: FlowRow[];
  wallets?: { address: string; label: string; type: string; origin: string }[];
  failed?: string[];
  message?: string;
  source?: { provider: string; fetchedAt: string };
  error?: string;
}

const WATCHLIST_KEY = "babata.watchlist.v1";
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * SmartMoney — labelled-wallet ("smart money") positioning.
 *
 * Honesty contract: this panel shows AGGREGATED cohort data from a labelling
 * provider. It never names an individual wallet as "the smart money" and never
 * invents numbers when the provider is unconfigured.
 */
export const SmartMoney: React.FC = () => {
  const [view, setView] = useState<View>("holdings");
  const [chain, setChain] = useState("");
  const [rows, setRows] = useState<(HoldingRow | NetflowRow)[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [isProxy, setIsProxy] = useState(false);
  const [unlock, setUnlock] = useState<SmartMoneyResponse["unlock"]>(undefined);

  // ── Live flows state ────────────────────────────────────────────
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState<string | null>(null);
  const [flowsFailed, setFlowsFailed] = useState<string[]>([]);
  const [flowsFetchedAt, setFlowsFetchedAt] = useState<string | null>(null);
  const [custom, setCustom] = useState<{ address: string; label: string }[]>([]);
  const [addrInput, setAddrInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [addrError, setAddrError] = useState<string | null>(null);

  // User watchlist is client-side only (localStorage) — addresses a user tracks
  // are their own data and never need to leave the browser except as a query.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustom(
          parsed
            .filter((e): e is { address: string; label?: string } =>
              Boolean(e) && typeof (e as { address?: unknown }).address === "string"
            )
            .slice(0, 8)
            .map((e) => ({ address: e.address, label: e.label || "" }))
        );
      }
    } catch {
      // Corrupt storage: start fresh rather than crash.
    }
  }, []);

  const persistCustom = (next: { address: string; label: string }[]) => {
    const capped = next.slice(0, 8);
    setCustom(capped);
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(capped));
    } catch {
      // Storage full/blocked: in-memory list still works for this session.
    }
  };

  const loadFlows = useCallback(async () => {
    setFlowsLoading(true);
    setFlowsError(null);
    try {
      const flowChain = FLOW_CHAINS.some((c) => c.id === chain) ? chain : "ethereum";
      const params = new URLSearchParams({ chain: flowChain, limit: "40" });
      if (custom.length > 0) params.set("addresses", custom.map((c) => c.address).join(","));
      const res = await apiFetch(`/api/smart-money/flows?${params.toString()}`);
      const data = (await res.json()) as FlowsResponse;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFlows(data.flows || []);
      setFlowsFailed(data.failed || []);
      setFlowsFetchedAt(data.source?.fetchedAt ?? null);
    } catch (err: unknown) {
      setFlowsError(err instanceof Error ? err.message : "Failed to load live flows");
      setFlows([]);
    } finally {
      setFlowsLoading(false);
    }
  }, [chain, custom]);

  useEffect(() => {
    if (view !== "flows") return;
    void loadFlows();
    const id = window.setInterval(() => void loadFlows(), 45_000);
    return () => window.clearInterval(id);
  }, [view, loadFlows]);

  const handleView = (v: View) => {
    setView(v);
    // The free flows source only serves ethereum/optimism entity feeds.
    if (v === "flows" && !FLOW_CHAINS.some((c) => c.id === chain)) setChain("ethereum");
  };

  const addWatched = () => {
    const address = addrInput.trim();
    if (!EVM_ADDRESS_RE.test(address)) {
      setAddrError("Enter a valid EVM address (0x…, 40 hex chars).");
      return;
    }
    if (custom.some((c) => c.address.toLowerCase() === address.toLowerCase())) {
      setAddrError("That address is already on your watchlist.");
      return;
    }
    if (custom.length >= 8) {
      setAddrError("Watchlist is full (8 addresses). Remove one first.");
      return;
    }
    persistCustom([...custom, { address, label: labelInput.trim().slice(0, 32) }]);
    setAddrInput("");
    setLabelInput("");
    setAddrError(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams({ view, limit: "25" });
      if (chain) params.set("chain", chain);
      const res = await apiFetch(`/api/smart-money?${params.toString()}`);
      const data = (await res.json()) as SmartMoneyResponse & { error?: string };

      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setConfigured(Boolean(data.configured));
      setRows(data.data || []);
      setMessage(data.message ?? null);
      setProvider(data.provider ?? "");
      setIsProxy(Boolean(data.proxy));
      setUnlock(data.unlock);
      setFetchedAt(data.source?.fetchedAt ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load smart-money data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view, chain]);

  useEffect(() => {
    // The flows view has its own loader; don't also hit the holdings endpoint.
    if (view === "flows") return;
    void load();
  }, [load, view]);

  const isNetflow = view === "netflows";
  const isFlows = view === "flows";

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="p-5 rounded-xl glass-hud border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-mono text-cyan-neon">SMART MONEY INTELLIGENCE</h2>
            <p className="text-xs text-gray-400 font-mono mt-1 max-w-2xl leading-relaxed">
              {isFlows ? (
                <>
                  Live ERC-20 flows of <span className="text-gray-200">publicly-known entity
                  wallets</span> (foundations, exchanges) plus any address you watch — refreshed
                  automatically every 45s. <span className="text-amber-glow">Labels are public
                  knowledge, not &ldquo;smart trader&rdquo; scores.</span> Free via Blockscout.
                </>
              ) : isProxy ? (
                <>
                  On-chain measurement of how concentrated each token&rsquo;s supply is.{" "}
                  <span className="text-amber-glow">This is a distribution proxy, not labelled
                  smart-money cohorts</span> — no wallet is identified as a &ldquo;smart trader&rdquo;.
                </>
              ) : (
                <>
                  What labelled &ldquo;smart money&rdquo; wallets are holding and whether they are net
                  buyers or sellers. Values are <span className="text-gray-200">aggregated across a
                    cohort of wallets</span> — not one identifiable trader.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (isFlows ? void loadFlows() : void load())}
            disabled={isFlows ? flowsLoading : loading}
            className="self-start px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 border-surface-border text-xs font-mono text-cyan-glow hover:text-cyan-neon transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isFlows ? flowsLoading : loading) ? "animate-spin" : ""}`} />
            REFRESH
          </button>
        </div>

        {/* Controls */}
        <div className="mt-4 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-1 border-surface-border">
            {(["holdings", "netflows", "flows"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleView(v)}
                className={`px-3 py-1 rounded text-xs font-mono transition-all ${view === v
                    ? "bg-cyan-neon/20 text-cyan-neon font-bold"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                {v === "holdings" ? "Holdings" : v === "netflows" ? "Net flows" : "Live flows"}
              </button>
            ))}
          </div>

          <select
            value={isFlows ? (FLOW_CHAINS.some((c) => c.id === chain) ? chain : "ethereum") : chain}
            onChange={(e) => setChain(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-1 border-surface-border text-xs font-mono text-gray-200 outline-none focus:border-cyan-neon"
          >
            {(isFlows ? FLOW_CHAINS : CHAINS).map((c) => (
              <option key={c.id || "all"} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {isFlows && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-cyber animate-pulse" />
              AUTO 45s
            </span>
          )}

          {fetchedAt && !isFlows && (
            <span className="text-[11px] font-mono text-gray-500 ml-auto">
              {provider && <span className="text-gray-400">{provider} · </span>}
              {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}

          {flowsFetchedAt && isFlows && (
            <span className="text-[11px] font-mono text-gray-500 ml-auto">
              blockscout · {new Date(flowsFetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Not configured */}
      {configured === false && !isFlows && (
        <div className="p-5 rounded-xl bg-surface-1/60 border-dashed border-surface-border">
          <div className="flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-cyan-neon mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-mono font-bold text-gray-100">
                Smart-money tracking is not enabled
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">{message}</p>
              <div className="mt-3 flex-wrap gap-2 text-[11px] font-mono">
                <span className="px-2 py-1 rounded bg-cyan-neon/10 border-cyan-neon/30 text-cyan-glow">
                  FREE · <code>MORALIS_API_KEY</code> → holder concentration
                </span>
                <span className="px-2 py-1 rounded bg-surface-2 border-surface-border text-gray-300">
                  PAID · <code>NANSEN_API_KEY</code> → labelled cohorts + net flows
                </span>
              </div>
              <p className="text-[11px] font-mono text-gray-500 mt-2 leading-relaxed">
                Set either in Vercel → Settings → Environment Variables, then redeploy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Proxy disclosure: never let measured concentration read as Nansen labels */}
      {configured && isProxy && !isFlows && (
        <div className="p-4 rounded-xl bg-amber-glow/10 border-amber-glow/40 text-xs font-mono leading-relaxed">
          <div className="flex items-start gap-2 text-amber-glow">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <strong>This is an on-chain proxy, not Nansen smart-money labels.</strong>{" "}
              {view === "holdings"
                ? "Values are the share of each token's supply held by its top 10 addresses (measured via Etherscan), sorted by concentration. High concentration means fewer wallets control the float — a distribution-risk signal, not a buy signal."
                : "Net flows require a labelled-wallet provider and are unavailable on the free proxy."}
              {unlock && (
                <div className="mt-2 text-gray-300">
                  Unlock labelled cohorts and net flows with <code className="text-cyan-glow">{unlock.envVar}</code> — {unlock.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && !isFlows && (
        <div className="p-4 rounded-xl bg-rose-flare/10 border-rose-flare/30 text-rose-flare text-xs font-mono">
          ⚠ {error}
        </div>
      )}

      {flowsError && isFlows && (
        <div className="p-4 rounded-xl bg-rose-flare/10 border-rose-flare/30 text-rose-flare text-xs font-mono">
          ⚠ {flowsError}
        </div>
      )}

      {/* ── Live flows feed (free, keyless) ─────────────────────────── */}
      {isFlows && (
        <>
          {/* Watchlist manager */}
          <div className="p-4 rounded-xl glass-hud border-surface-border">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
                  Watchlist
                </h3>
                <span className="text-[10px] font-mono text-gray-500">
                  Built-in: Ethereum Foundation · Vitalik Buterin · Binance hot wallet
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {custom.map((c) => (
                  <span
                    key={c.address.toLowerCase()}
                    className="group flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-surface-1 border-surface-border text-[11px] font-mono text-gray-200"
                  >
                    {c.label || `${c.address.slice(0, 6)}…${c.address.slice(-4)}`}
                    <button
                      type="button"
                      aria-label={`Remove ${c.label || c.address} from watchlist`}
                      onClick={() =>
                        persistCustom(custom.filter((x) => x.address.toLowerCase() !== c.address.toLowerCase()))
                      }
                      className="p-0.5 rounded text-gray-500 hover:text-rose-flare transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {custom.length === 0 && (
                  <span className="text-[11px] font-mono text-gray-500">
                    No custom addresses yet — add any wallet below to track it live.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                  placeholder="0x… address to watch"
                  spellCheck={false}
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-surface-1 border-surface-border text-[11px] font-mono text-gray-200 outline-none focus:border-cyan-neon"
                />
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="Label (optional)"
                  maxLength={32}
                  className="w-40 px-3 py-2 rounded-lg bg-surface-1 border-surface-border text-[11px] font-mono text-gray-200 outline-none focus:border-cyan-neon"
                />
                <button
                  type="button"
                  onClick={addWatched}
                  className="px-3 py-2 rounded-lg bg-cyan-neon/15 border-cyan-neon/40 text-cyan-neon text-[11px] font-mono font-bold hover:bg-cyan-neon/25 transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> WATCH
                </button>
              </div>
              {addrError && (
                <p className="text-[11px] font-mono text-rose-flare">{addrError}</p>
              )}
              {flowsFailed.length > 0 && (
                <p className="text-[10px] font-mono text-amber-glow">
                  Some wallets could not be queried: {flowsFailed.join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* Feed */}
          <div className="rounded-xl glass-hud border-surface-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-surface-border/60 text-[10px] font-mono uppercase tracking-wider text-gray-500">
              <span className="col-span-2">Time</span>
              <span className="col-span-3">Wallet</span>
              <span className="col-span-1">Dir</span>
              <span className="col-span-3">Token / amount</span>
              <span className="col-span-2 text-right">Value</span>
              <span className="col-span-1 text-right">Tx</span>
            </div>

            {flowsLoading && flows.length === 0 && (
              <div className="py-12 flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Reading the chain…
              </div>
            )}

            {!flowsLoading && flows.length === 0 && !flowsError && (
              <div className="py-12 text-center text-xs font-mono text-gray-500">
                No recent token flows found for the watchlist on this chain.
              </div>
            )}

            {flows.map((f, idx) => {
              const isIn = f.direction === "in";
              const host = FLOW_HOSTS[f.chain] || FLOW_HOSTS.ethereum;
              return (
                <div
                  key={`${f.txHash}-${f.walletAddress}-${idx}`}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-surface-border/30 last:border-0 text-xs font-mono hover:bg-surface-1/60 transition-colors items-center"
                >
                  <span
                    className="col-span-2 text-gray-500"
                    title={new Date(f.timestamp).toLocaleString()}
                  >
                    {timeAgo(f.timestamp)}
                  </span>
                  <span className="col-span-3 text-gray-100 font-bold truncate" title={f.walletAddress}>
                    {f.walletLabel}
                  </span>
                  <span
                    className={`col-span-1 flex items-center gap-0.5 font-bold ${isIn ? "text-emerald-cyber" : "text-rose-flare"}`}
                  >
                    {isIn ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    {isIn ? "IN" : "OUT"}
                  </span>
                  <span className="col-span-3 text-gray-200 truncate" title={f.tokenName || f.tokenSymbol}>
                    <span className="font-bold">{f.tokenSymbol}</span>{" "}
                    <span className="text-gray-400">{fmtAmount(f.amount)}</span>
                  </span>
                  <span className={`col-span-2 text-right font-semibold ${isIn ? "text-emerald-cyber" : "text-rose-flare"}`}>
                    {fmtUsd(f.valueUsd)}
                  </span>
                  <span className="col-span-1 text-right">
                    {f.txHash ? (
                      <a
                        href={`${host}/tx/${f.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Counterparty: ${f.counterparty}`}
                        className="text-cyan-glow hover:text-cyan-neon underline decoration-dotted"
                      >
                        view
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Table */}
      {configured && !isFlows && (
        <div className="rounded-xl glass-hud border-surface-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-surface-border/60 text-[10px] font-mono uppercase tracking-wider text-gray-500">
            <span className="col-span-1">#</span>
            <span className="col-span-3">Token</span>
            <span className="col-span-2">Chain</span>
            <span className="col-span-3 text-right">
              {isNetflow ? "Net flow (USD)" : isProxy ? "Top-10 concentration" : "Smart money value"}
            </span>
            <span className="col-span-3 text-right">
              {isNetflow ? "Traders" : "24h balance change"}
            </span>
          </div>

          {loading && rows.length === 0 && (
            <div className="py-12 flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Querying labelled-wallet data…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="py-12 text-center text-xs font-mono text-gray-500">
              No rows returned for this chain/view.
            </div>
          )}

          {rows.map((row, idx) => {
            const holding = row as HoldingRow;
            const netflow = row as NetflowRow;
            const symbol = holding.tokenSymbol || netflow.tokenSymbol || "?";
            const primaryValue = isNetflow ? netflow.netflowUsd : holding.valueUsd;
            const secondary = isNetflow
              ? netflow.tradersCount
              : holding.balance24hPercentChange;
            const positive = isNetflow ? primaryValue >= 0 : (secondary ?? 0) >= 0;

            return (
              <div
                key={`${row.chain}-${row.tokenAddress}-${idx}`}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-surface-border/30 last:border-0 text-xs font-mono hover:bg-surface-1/60 transition-colors items-center"
              >
                <span className="col-span-1 text-gray-500">{idx + 1}</span>
                <span className="col-span-3 text-gray-100 font-bold truncate">{symbol}</span>
                <span className="col-span-2 text-gray-400 uppercase text-[10px]">{row.chain}</span>
                <span
                  className={`col-span-3 text-right font-semibold flex items-center justify-end gap-1 ${positive ? "text-emerald-cyber" : "text-rose-flare"
                    }`}
                >
                  {isNetflow &&
                    (positive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    ))}
                  {fmtUsd(primaryValue)}
                </span>
                <span className="col-span-3 text-right text-gray-400">
                  {typeof secondary === "number"
                    ? `${secondary >= 0 ? "+" : ""}${secondary.toFixed(1)}${isNetflow ? "" : "%"}`
                    : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Method note */}
      <div className="flex items-start gap-2 text-[11px] font-mono text-gray-500 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {isFlows ? (
            <>
              Live flows are read from public Blockscout explorers (free, no key). Built-in labels
              cover only publicly-known entities; your watched addresses stay in this browser.
              Treat large flows as <span className="text-gray-300">context, not trade signals</span> —
              verify contracts before acting.
            </>
          ) : (
            <>
              Labels (e.g. &ldquo;Smart Trader&rdquo;, &ldquo;Fund&rdquo;) come from the data provider,
              not from this app. Treat cohort flows as a crowding signal, not as proof of insider
              activity, and verify token contracts independently before acting.
            </>
          )}
        </span>
      </div>
    </div>
  );
};

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtAmount(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(3);
  return v.toPrecision(4);
}

function fmtUsd(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}
