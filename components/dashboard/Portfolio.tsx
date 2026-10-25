"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, Wallet, Search, Info } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { useCoinUniverse } from "@/lib/hooks/useCoinUniverse";

interface Holding {
  coinId: string;
  symbol: string;
  amount: number;
}

interface PortfolioPrice {
  id: string;
  symbol: string;
  name: string;
  priceUsd?: number;
  change24hPct?: number;
  image?: string;
}

const STORAGE_KEY = "babata.portfolio.v1";
const MAX_HOLDINGS = 30;

function loadHoldings(): Holding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (h): h is Holding =>
          h &&
          typeof h.coinId === "string" &&
          typeof h.symbol === "string" &&
          typeof h.amount === "number" &&
          Number.isFinite(h.amount) &&
          h.amount >= 0
      )
      .slice(0, MAX_HOLDINGS);
  } catch {
    return [];
  }
}

/**
 * Portfolio — a private, browser-local holdings tracker valued with live
 * CoinGecko prices. Holdings never leave the browser except as coin slugs in
 * a price query. Not investment advice; values are indicative marks.
 */
export const Portfolio: React.FC = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [prices, setPrices] = useState<Record<string, PortfolioPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  // Add-holding form
  const { filtered, search, setSearch } = useCoinUniverse();
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<{ id: string; symbol: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setHoldings(loadHoldings());
  }, []);

  const persist = (next: Holding[]) => {
    setHoldings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_HOLDINGS)));
    } catch {
      // Storage blocked: session-only mode.
    }
  };

  const load = useCallback(async () => {
    const current = loadHoldings();
    if (current.length === 0) {
      setPrices({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ids = current.map((h) => h.coinId).join(",");
      const res = await apiFetch(`/api/market/portfolio?ids=${encodeURIComponent(ids)}`);
      const json = (await res.json()) as { data?: PortfolioPrice[]; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
      const map: Record<string, PortfolioPrice> = {};
      for (const p of json.data) map[p.id] = p;
      setPrices(map);
      setFetchedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio prices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load, holdings.length]);

  const rows = useMemo(
    () =>
      holdings.map((h) => {
        const p = prices[h.coinId];
        const value = p?.priceUsd !== undefined ? p.priceUsd * h.amount : undefined;
        return { ...h, price: p?.priceUsd, change24hPct: p?.change24hPct, value };
      }),
    [holdings, prices]
  );

  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalCostBasisMissing = rows.some((r) => r.value === undefined);
  const weightedChange = (() => {
    const withValue = rows.filter((r) => r.value !== undefined && r.change24hPct !== undefined);
    const sum = withValue.reduce((s, r) => s + (r.value as number), 0);
    if (sum <= 0) return undefined;
    return withValue.reduce(
      (s, r) => s + (r.change24hPct as number) * ((r.value as number) / sum),
      0
    );
  })();

  const suggestions = useMemo(
    () => filtered.slice(0, 6),
    [filtered]
  );

  const pick = (coin: { id: string; symbol: string; name: string }) => {
    setPicked({ id: coin.id, symbol: coin.symbol });
    setSearch(coin.name);
    setShowPicker(false);
    setFormError(null);
  };

  const addHolding = () => {
    const amt = Number(amount);
    if (!picked) {
      setFormError("Pick a coin first.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setFormError("Enter a positive amount.");
      return;
    }
    if (holdings.length >= MAX_HOLDINGS) {
      setFormError(`Portfolio is full (${MAX_HOLDINGS} coins).`);
      return;
    }
    const existing = holdings.find((h) => h.coinId === picked.id);
    if (existing) {
      persist(
        holdings.map((h) =>
          h.coinId === picked.id ? { ...h, amount: h.amount + amt } : h
        )
      );
    } else {
      persist([...holdings, { coinId: picked.id, symbol: picked.symbol, amount: amt }]);
    }
    setPicked(null);
    setSearch("");
    setAmount("");
    setFormError(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="p-5 rounded-xl glass-hud border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold font-mono text-cyan-neon">PORTFOLIO</h2>
            <p className="text-xs text-gray-400 font-mono mt-1 max-w-2xl leading-relaxed">
              Your holdings, valued live. <span className="text-amber-glow">Stored only in this
              browser</span> — nothing is uploaded. Prices are indicative marks from CoinGecko,
              not executable quotes.
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

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-surface-border/50">
          <div>
            <span className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
              <Wallet className="w-3.5 h-3.5 text-cyan-neon" /> TOTAL VALUE
            </span>
            <p className="text-2xl font-mono font-extrabold text-cyan-neon mt-1">
              {totalValue > 0 ? fmtUsd(totalValue) : totalCostBasisMissing && rows.length > 0 ? "—" : "$0.00"}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-mono text-gray-400">24H CHANGE (WEIGHTED)</span>
            <p
              className={`text-2xl font-mono font-extrabold mt-1 ${
                (weightedChange ?? 0) >= 0 ? "text-emerald-cyber" : "text-rose-flare"
              }`}
            >
              {weightedChange === undefined ? "—" : `${weightedChange >= 0 ? "+" : ""}${weightedChange.toFixed(2)}%`}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-flare/10 border-rose-flare/30 text-rose-flare text-xs font-mono">
          ⚠ {error}
        </div>
      )}

      {/* Add holding */}
      <div className="p-4 rounded-xl glass-hud border-surface-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-1 border border-surface-border focus-within:border-cyan-neon">
              <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPicked(null);
                  setShowPicker(true);
                }}
                onFocus={() => setShowPicker(true)}
                placeholder="Search a coin to add (e.g. Bitcoin)"
                className="flex-1 bg-transparent outline-none text-xs font-mono text-gray-100 placeholder-gray-500"
              />
              {picked && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon text-[10px] font-mono font-bold">
                  {picked.symbol}
                </span>
              )}
            </div>
            {showPicker && search.trim().length > 0 && !picked && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl bg-canvas border border-surface-border shadow-hud-cyan overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-left hover:bg-surface-1/70 transition-colors"
                  >
                    <span className="text-gray-100">
                      <span className="font-bold">{c.symbol}</span>{" "}
                      <span className="text-gray-400">{c.name}</span>
                    </span>
                    <Plus className="w-3 h-3 text-cyan-neon" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHolding();
              }
            }}
            inputMode="decimal"
            placeholder="Amount (e.g. 0.5)"
            className="w-full sm:w-40 px-3 py-2.5 rounded-xl bg-surface-1 border border-surface-border text-xs font-mono text-gray-100 outline-none focus:border-cyan-neon placeholder-gray-500"
          />
          <button
            type="button"
            onClick={addHolding}
            className="px-4 py-2.5 rounded-xl bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon text-xs font-mono font-bold hover:bg-cyan-neon/25 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> ADD
          </button>
        </div>
        {formError && <p className="mt-2 text-[11px] font-mono text-rose-flare">{formError}</p>}
      </div>

      {/* Holdings */}
      <div className="rounded-xl glass-hud border-surface-border overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-surface-border/60 text-[10px] font-mono uppercase tracking-wider text-gray-500">
          <span className="col-span-4">Coin</span>
          <span className="col-span-2 text-right">Amount</span>
          <span className="col-span-2 text-right">Price</span>
          <span className="col-span-3 text-right">Value / 24h</span>
          <span className="col-span-1"></span>
        </div>

        {rows.length === 0 && (
          <div className="py-12 text-center text-xs font-mono text-gray-500">
            No holdings yet — search a coin above and add your first position.
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.coinId}
            className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-surface-border/30 last:border-0 text-xs font-mono hover:bg-surface-1/60 transition-colors items-center"
          >
            <span className="col-span-4 flex items-center gap-2 min-w-0">
              {r.price === undefined ? (
                <span title="Price unavailable for this id" className="flex shrink-0">
                  <Info className="w-3 h-3 text-gray-600" />
                </span>
              ) : null}
              <span className="text-gray-100 font-bold">{r.symbol}</span>
            </span>
            <span className="col-span-2 text-right text-gray-200">{fmtAmount(r.amount)}</span>
            <span className="col-span-2 text-right text-gray-300">
              {r.price !== undefined ? `$${r.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "—"}
            </span>
            <span className="col-span-3 text-right flex flex-col items-end">
              <span className="text-gray-100 font-semibold">{r.value !== undefined ? fmtUsd(r.value) : "—"}</span>
              {r.change24hPct !== undefined && (
                <span className={`text-[10px] ${(r.change24hPct ?? 0) >= 0 ? "text-emerald-cyber" : "text-rose-flare"}`}>
                  {(r.change24hPct ?? 0) >= 0 ? "+" : ""}
                  {r.change24hPct.toFixed(2)}%
                </span>
              )}
            </span>
            <span className="col-span-1 text-right">
              <button
                type="button"
                aria-label={`Remove ${r.symbol} from portfolio`}
                onClick={() => persist(holdings.filter((h) => h.coinId !== r.coinId))}
                className="p-1 rounded text-gray-500 hover:text-rose-flare transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        ))}

        {loading && rows.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-2 text-[10px] font-mono text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" /> refreshing prices…
          </div>
        )}
      </div>
    </div>
  );
};

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtAmount(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 1) return v.toFixed(4);
  return v.toPrecision(4);
}
