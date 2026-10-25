"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

interface MoverCoin {
  symbol: string;
  priceUsd?: number;
  change24h?: number;
}

interface MoversResponse {
  gainers?: MoverCoin[];
  losers?: MoverCoin[];
}

/**
 * TickerTape — scrolling strip of top gainers & losers, self-built from the
 * existing movers endpoint (no third-party embed scripts, no new dependency).
 * Renders nothing while it has no data, so it never breaks the layout.
 */
export const TickerTape: React.FC = () => {
  const [items, setItems] = useState<MoverCoin[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await apiFetch("/api/market/movers?limit=8");
        if (!res.ok) return;
        const json = (await res.json()) as MoversResponse;
        if (!alive) return;
        const next = [...(json.gainers || []), ...(json.losers || [])].filter(
          (c) => typeof c.symbol === "string"
        );
        if (next.length > 0) setItems(next);
      } catch {
        // Tape is decorative — silently keep the last data on refresh failures.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (items.length === 0) return null;

  // Two copies back-to-back let the CSS keyframe loop seamlessly.
  const loop = [...items, ...items];

  return (
    <div
      className="w-full overflow-hidden border-b border-surface-border/60 bg-canvas/70 backdrop-blur-sm group relative z-10"
      aria-hidden="true"
    >
      <div className="ticker-track flex items-center gap-8 py-1.5 w-max group-hover:[animation-play-state:paused]">
        {loop.map((c, i) => {
          const up = (c.change24h ?? 0) >= 0;
          return (
            <span key={`${c.symbol}-${i}`} className="flex items-center gap-1.5 text-[11px] font-mono whitespace-nowrap">
              <span className="text-gray-300 font-bold">{c.symbol}</span>
              {c.priceUsd !== undefined && (
                <span className="text-gray-500">
                  ${c.priceUsd.toLocaleString(undefined, { maximumFractionDigits: c.priceUsd < 1 ? 6 : 2 })}
                </span>
              )}
              {c.change24h !== undefined && (
                <span className={up ? "text-emerald-cyber" : "text-rose-flare"}>
                  {up ? "▲" : "▼"} {up ? "+" : ""}
                  {c.change24h.toFixed(2)}%
                </span>
              )}
              <span className="text-surface-border">·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
