"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Info, Layers, Coins, Percent } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface DefiOverview {
  totalTvlUsd: number;
  topChains: { name: string; tvlUsd: number }[];
  topProtocols: { name: string; category?: string; tvlUsd: number; change24hPct?: number }[];
  stablecoins: { totalUsd: number; top: { symbol: string; name: string; usd: number }[] };
}
interface YieldPool {
  project: string;
  chain: string;
  pair: string;
  tvlUsd: number;
  apyPct: number;
}
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * DefiPulse — where the money actually sits: chain/protocol TVL, stablecoin
 * supply and the highest-APY stablecoin pools. All free via DefiLlama.
 * APYs are point-in-time observations from a public indexer — never offers.
 */
export const DefiPulse: React.FC = () => {
  const [overview, setOverview] = useState<DefiOverview | null>(null);
  const [yields, setYields] = useState<YieldPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, yRes] = await Promise.all([
        apiFetch("/api/defi/overview"),
        apiFetch("/api/defi/yields"),
      ]);
      const ov = (await ovRes.json()) as ApiResponse<DefiOverview>;
      const y = (await yRes.json()) as ApiResponse<YieldPool[]>;
      if (!ovRes.ok || !ov.data) throw new Error(ov.error || `Overview HTTP ${ovRes.status}`);
      setOverview(ov.data);
      setYields(yRes.ok && y.data ? y.data : []);
      setFetchedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load DeFi data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 300_000);
    return () => window.clearInterval(id);
  }, [load]);

  const maxChainTvl = overview?.topChains[0]?.tvlUsd ?? 1;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="p-5 rounded-xl glass-hud border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-mono text-cyan-neon">DEFI PULSE</h2>
            <p className="text-xs text-gray-400 font-mono mt-1 max-w-2xl leading-relaxed">
              Where value actually sits: chain and protocol TVL, stablecoin supply, and the
              highest-yielding stablecoin pools with real deposits.{" "}
              <span className="text-amber-glow">APYs are observations, not offers</span> — verify
              every protocol independently. Free via DefiLlama.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {fetchedAt && !loading && (
              <span className="text-[11px] font-mono text-gray-500">updated {fetchedAt}</span>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-surface-1 hover:bg-surface-2 border-surface-border text-xs font-mono text-cyan-glow hover:text-cyan-neon transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              REFRESH
            </button>
          </div>
        </div>

        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-border/50">
            <BigStat label="TOTAL TVL" value={fmtUsd(overview.totalTvlUsd)} icon={<Layers className="w-3.5 h-3.5 text-cyan-neon" />} />
            <BigStat label="STABLECOIN SUPPLY" value={fmtUsd(overview.stablecoins.totalUsd)} icon={<Coins className="w-3.5 h-3.5 text-emerald-cyber" />} />
            <BigStat label="TOP CHAIN" value={overview.topChains[0]?.name ?? "--"} icon={<Info className="w-3.5 h-3.5 text-violet-electric" />} />
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-flare/10 border-rose-flare/30 text-rose-flare text-xs font-mono">
          ⚠ {error}
        </div>
      )}

      {loading && !overview && (
        <div className="p-12 rounded-xl glass-hud border-surface-border flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading DefiLlama…
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chains by TVL */}
          <div className="rounded-xl glass-hud border-surface-border p-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider mb-3">
              Chains by TVL
            </h3>
            <div className="space-y-2">
              {overview.topChains.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-24 truncate text-gray-200">{c.name}</span>
                  <div className="flex-1 h-2 rounded bg-surface-1 overflow-hidden">
                    <div
                      className="h-full rounded bg-cyan-neon/60"
                      style={{ width: `${Math.max(2, (c.tvlUsd / maxChainTvl) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-gray-300">{fmtUsd(c.tvlUsd)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Protocols by TVL */}
          <div className="rounded-xl glass-hud border-surface-border overflow-hidden">
            <div className="px-4 py-2 border-b border-surface-border/60 text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
              Protocols by TVL
            </div>
            <div className="max-h-72 overflow-y-auto">
              {overview.topProtocols.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between px-4 py-2 border-b border-surface-border/30 last:border-0 text-xs font-mono"
                >
                  <span className="min-w-0 truncate text-gray-100 font-bold">{p.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    {p.category && (
                      <span className="text-[10px] text-gray-500 hidden sm:inline">{p.category}</span>
                    )}
                    {p.change24hPct !== undefined && (
                      <span className={p.change24hPct >= 0 ? "text-emerald-cyber" : "text-rose-flare"}>
                        {p.change24hPct >= 0 ? "+" : ""}
                        {p.change24hPct.toFixed(1)}%
                      </span>
                    )}
                    <span className="w-20 text-right text-gray-300">{fmtUsd(p.tvlUsd)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stablecoins */}
          <div className="rounded-xl glass-hud border-surface-border p-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider mb-3">
              Stablecoin supply leaders
            </h3>
            <div className="flex flex-wrap gap-2">
              {overview.stablecoins.top.map((s) => (
                <span
                  key={s.symbol}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-1 border border-surface-border text-[11px] font-mono"
                  title={s.name}
                >
                  <span className="font-bold text-gray-100">{s.symbol}</span>{" "}
                  <span className="text-gray-300">{fmtUsd(s.usd)}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Yields */}
          <div className="rounded-xl glass-hud border-surface-border overflow-hidden">
            <div className="px-4 py-2 border-b border-surface-border/60 flex items-center gap-1.5 text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
              <Percent className="w-3.5 h-3.5 text-emerald-cyber" /> Top stablecoin yields (TVL ≥ $10M)
            </div>
            {yields.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs font-mono text-gray-500">
                Yield feed unavailable right now.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {yields.map((y, i) => (
                  <div
                    key={`${y.project}-${y.chain}-${i}`}
                    className="flex items-center justify-between px-4 py-2 border-b border-surface-border/30 last:border-0 text-xs font-mono"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-gray-100 font-bold">{y.pair}</span>{" "}
                      <span className="text-gray-500">{y.project}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-gray-500 hidden sm:inline">{y.chain}</span>
                      <span className="text-gray-300 w-20 text-right">{fmtUsd(y.tvlUsd)}</span>
                      <span className="text-emerald-cyber font-bold w-16 text-right">
                        {y.apyPct.toFixed(2)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BigStat: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div>
    <span className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
      {icon}
      {label}
    </span>
    <p className="text-base font-mono font-bold text-gray-100 mt-0.5 truncate">{value}</p>
  </div>
);

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toFixed(0)}`;
}
