"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Flame, Gauge, TrendingUp, TrendingDown, Fuel } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { CoinSummary } from "@/lib/providers/interfaces";

interface FearGreed {
  value: number;
  classification: string;
  previousValue?: number;
  history?: number[];
}
interface GlobalStats {
  totalMarketCapUsd: number;
  marketCapChange24hPct: number;
  totalVolumeUsd: number;
  btcDominancePct: number;
  ethDominancePct: number;
}
interface EthGas {
  slowGwei: number;
  averageGwei: number;
  fastGwei: number;
}
interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  rank?: number;
  priceUsd?: number;
  change24hPct?: number;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * MarketPulse — global market vitals strip: Fear & Greed, total cap/dominance,
 * Ethereum gas and trending coins. Every section degrades independently; a
 * dead feed never blanks the others. All sources are free and keyless.
 */
export const MarketPulse: React.FC<{ onSelect: (coin: CoinSummary) => void }> = ({
  onSelect,
}) => {
  const [fng, setFng] = useState<FearGreed | null>(null);
  const [global, setGlobal] = useState<GlobalStats | null>(null);
  const [gas, setGas] = useState<EthGas | null>(null);
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async () => {
    const grab = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await apiFetch(url);
        const json = (await res.json()) as ApiResponse<T>;
        if (!res.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
        return json.data;
      } catch {
        return null;
      }
    };
    const [f, g, ga, t] = await Promise.all([
      grab<FearGreed>("/api/market/fear-greed"),
      grab<GlobalStats>("/api/market/global"),
      grab<EthGas>("/api/market/gas"),
      grab<TrendingCoin[]>("/api/market/trending"),
    ]);
    setFng(f);
    setGlobal(g);
    setGas(ga);
    setTrending(t || []);
    setDegraded(!f && !g && !ga && (t || []).length === 0);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (degraded) return null; // all feeds down — hide the strip, honest silence

  const fngPrev = fng?.previousValue;
  const fngDelta = fng && fngPrev !== undefined ? fng.value - fngPrev : undefined;
  const fngPositive = (fngDelta ?? 0) >= 0;

  return (
    <div className="p-4 rounded-xl glass-hud border border-surface-border space-y-3">
      {/* Vitals row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono">
        {fng && (
          <span className="flex items-center gap-1.5" title="Crypto Fear & Greed Index (alternative.me)">
            <Gauge
              className={`w-3.5 h-3.5 ${
                fng.value >= 55 ? "text-emerald-cyber" : fng.value <= 45 ? "text-rose-flare" : "text-amber-glow"
              }`}
            />
            <span className="text-gray-400">F&amp;G</span>
            <span
              className={`font-bold ${
                fng.value >= 55 ? "text-emerald-cyber" : fng.value <= 45 ? "text-rose-flare" : "text-amber-glow"
              }`}
            >
              {fng.value}
            </span>
            <span className="text-gray-500">{fng.classification}</span>
            {fngDelta !== undefined && (
              <span className={fngPositive ? "text-emerald-cyber" : "text-rose-flare"}>
                {fngPositive ? "▲" : "▼"}
                {Math.abs(fngDelta)}
              </span>
            )}
            {fng.history && fng.history.length > 1 && (
              <span className="flex items-end gap-[3px] h-3.5" title="Last 8 days">
                {fng.history.map((v, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-sm ${
                      v >= 55 ? "bg-emerald-cyber/70" : v <= 45 ? "bg-rose-flare/70" : "bg-amber-glow/70"
                    }`}
                    style={{ height: `${Math.max(20, (v / 100) * 100)}%` }}
                  />
                ))}
              </span>
            )}
          </span>
        )}

        {global && (
          <>
            <span className="flex items-center gap-1.5" title="Total crypto market capitalization">
              <span className="text-gray-400">MCAP</span>
              <span className="font-bold text-gray-100">{fmtCompact(global.totalMarketCapUsd, true)}</span>
              <span className={global.marketCapChange24hPct >= 0 ? "text-emerald-cyber" : "text-rose-flare"}>
                {global.marketCapChange24hPct >= 0 ? "+" : ""}
                {global.marketCapChange24hPct.toFixed(1)}%
              </span>
            </span>
            <span title="Bitcoin dominance" className="hidden sm:flex items-center gap-1.5">
              <span className="text-gray-400">BTC DOM</span>
              <span className="font-bold text-amber-glow">{global.btcDominancePct.toFixed(1)}%</span>
            </span>
            <span title="Ethereum dominance" className="hidden md:flex items-center gap-1.5">
              <span className="text-gray-400">ETH DOM</span>
              <span className="font-bold text-violet-electric">{global.ethDominancePct.toFixed(1)}%</span>
            </span>
          </>
        )}

        {gas && (
          <span className="flex items-center gap-1.5" title="Ethereum gas — slow / average / fast (Blockscout)">
            <Fuel className="w-3.5 h-3.5 text-cyan-glow" />
            <span className="text-gray-400">GAS</span>
            <span className="text-gray-300">
              {gas.slowGwei.toFixed(2)} / <span className="font-bold text-cyan-neon">{gas.averageGwei.toFixed(2)}</span> /{" "}
              {gas.fastGwei.toFixed(2)} gwei
            </span>
          </span>
        )}
      </div>

      {/* Trending row */}
      {trending.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-surface-border/50">
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-gray-500">
            <Flame className="w-3 h-3 text-amber-glow" /> Trending
          </span>
          {trending.map((t) => {
            const up = (t.change24hPct ?? 0) >= 0;
            const coin: CoinSummary = {
              id: t.id,
              symbol: t.symbol,
              name: t.name,
              priceUsd: t.priceUsd,
              change24h: t.change24hPct,
            };
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(coin)}
                title={`${t.name}${t.rank ? ` · rank #${t.rank}` : ""} — open in terminal`}
                className="px-2 py-0.5 rounded bg-surface-1 border border-surface-border text-[11px] font-mono text-gray-200 hover:border-cyan-neon/50 hover:text-cyan-neon transition-all flex items-center gap-1"
              >
                <span className="font-bold">{t.symbol}</span>
                {t.change24hPct !== undefined && (
                  <span className={`flex items-center ${up ? "text-emerald-cyber" : "text-rose-flare"}`}>
                    {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {up ? "+" : ""}
                    {t.change24hPct.toFixed(1)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

function fmtCompact(v: number, withDollar: boolean): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const unit = abs >= 1e12 ? "T" : abs >= 1e9 ? "B" : abs >= 1e6 ? "M" : "";
  const num = unit ? (abs / (unit === "T" ? 1e12 : unit === "B" ? 1e9 : 1e6)).toFixed(2) : abs.toFixed(0);
  return `${sign}${withDollar ? "$" : ""}${num}${unit}`;
}
