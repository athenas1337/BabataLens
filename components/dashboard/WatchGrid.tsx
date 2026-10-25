"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LayoutGrid, ChevronDown, ChevronUp, Star } from "lucide-react";
import { buildMiniSymbolOverviewParams, TRADINGVIEW_MINI_CHART_BASE } from "@/lib/tradingview/symbols";

/** Favorite entries carry enough data to render a chart without refetching. */
export interface FavoriteCoin {
  id: string;
  symbol: string;
  name: string;
  tradingViewSymbol?: string;
}

const FAVORITES_KEY = "babata.favorites.v1";

export { FAVORITES_KEY };

/** Reads favorites, upgrading legacy string-id entries transparently. */
export function readFavorites(): FavoriteCoin[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((e): FavoriteCoin | null => {
        if (typeof e === "string") return { id: e, symbol: e.toUpperCase(), name: e };
        if (e && typeof e === "object" && typeof e.id === "string") {
          return {
            id: e.id,
            symbol: typeof e.symbol === "string" ? e.symbol : e.id.toUpperCase(),
            name: typeof e.name === "string" ? e.name : e.id,
            tradingViewSymbol: typeof e.tradingViewSymbol === "string" ? e.tradingViewSymbol : undefined,
          };
        }
        return null;
      })
      .filter((e): e is FavoriteCoin => e !== null)
      .slice(0, 8);
  } catch {
    return [];
  }
}

const MiniChart: React.FC<{ tvSymbol: string; name: string }> = ({ tvSymbol, name }) => {
  const src = `${TRADINGVIEW_MINI_CHART_BASE}${buildMiniSymbolOverviewParams(tvSymbol)}`;
  return (
    <div className="rounded-lg overflow-hidden border border-surface-border bg-canvas">
      <iframe
        key={tvSymbol}
        title={`TradingView mini chart for ${name}`}
        src={src}
        style={{ width: "100%", height: 160, border: "none", display: "block" }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};

/**
 * WatchGrid — pinned TradingView mini charts for the coins starred in the
 * selector (same localStorage favorites, shared key). Collapsed by default
 * when no favorites exist; never fetches anything server-side.
 */
export const WatchGrid: React.FC = () => {
  const [favorites, setFavorites] = useState<FavoriteCoin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setFavorites(readFavorites());
    setLoaded(true);
    // Re-read when the user returns from another tab (favorites may change).
    const onVisible = () => {
      if (document.visibilityState === "visible") setFavorites(readFavorites());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const chartables = useMemo(
    () => favorites.filter((f) => f.tradingViewSymbol),
    [favorites]
  );

  if (!loaded) return null;

  return (
    <div className="rounded-xl glass-hud border border-surface-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono text-gray-300 hover:text-cyan-neon hover:bg-surface-1/50 transition-all"
      >
        <span className="flex items-center gap-2 uppercase tracking-wider font-bold">
          <LayoutGrid className="w-3.5 h-3.5 text-cyan-neon" />
          Watch Grid
          {chartables.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-neon/10 border border-cyan-neon/30 text-cyan-neon text-[10px]">
              {chartables.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-surface-border/50">
          {chartables.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-gray-500 flex items-center justify-center gap-1.5">
              <Star className="w-3 h-3" />
              Star coins in the selector to pin live mini charts here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {chartables.map((f) => (
                <MiniChart key={f.id} tvSymbol={f.tradingViewSymbol as string} name={f.name} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
