"use client";

import React, { useState } from "react";
import { Loader2, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

interface CoinProfileData {
  id: string;
  name: string;
  symbol: string;
  categories: string[];
  description: string;
  homepage?: string;
  twitter?: string;
  marketCapRank?: number;
  genesisDate?: string;
  athUsd?: number;
  athChangePct?: number;
  atlUsd?: number;
  circulatingSupply?: number;
  totalSupply?: number;
}

const PROFILE_DESC_LIMIT = 380;

/**
 * CoinProfile — deep-dive fundamentals for the selected coin (ATH/ATL
 * distance, supplies, categories, links). Lazy: only fetches when the
 * operator expands it, so casual coin-switching never burns the feed.
 */
export const CoinProfile: React.FC<{ coinId: string; coinSymbol: string }> = ({
  coinId,
  coinSymbol,
}) => {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<CoinProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !profile && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/market/coin-profile?id=${encodeURIComponent(coinId)}`);
        const json = (await res.json()) as { data?: CoinProfileData; error?: string };
        if (!res.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
        setProfile(json.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Profile feed unavailable");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="rounded-xl glass-hud border border-surface-border overflow-hidden">
      <button
        type="button"
        onClick={() => void toggle()}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono text-gray-300 hover:text-cyan-neon hover:bg-surface-1/50 transition-all"
      >
        <span className="uppercase tracking-wider font-bold">
          {coinSymbol} Fundamentals
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-surface-border/50">
          {loading && (
            <div className="py-6 flex items-center justify-center gap-2 text-xs font-mono text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading CoinGecko profile…
            </div>
          )}
          {error && !loading && (
            <div className="py-4 flex items-center gap-2 text-xs font-mono text-amber-glow">
              <XCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
          {profile && !loading && (
            <div className="space-y-3">
              {/* Key facts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <Stat
                  label="ALL-TIME HIGH"
                  value={profile.athUsd !== undefined ? fmtPrice(profile.athUsd) : "—"}
                  sub={
                    profile.athChangePct !== undefined ? (
                      <span className="text-rose-flare">
                        <TrendingDown className="w-2.5 h-2.5 inline" /> {profile.athChangePct.toFixed(1)}% below
                      </span>
                    ) : undefined
                  }
                />
                <Stat
                  label="ALL-TIME LOW"
                  value={profile.atlUsd !== undefined ? fmtPrice(profile.atlUsd) : "—"}
                  sub={
                    profile.athUsd !== undefined && profile.atlUsd !== undefined && profile.atlUsd > 0 ? (
                      <span className="text-emerald-cyber">
                        <TrendingUp className="w-2.5 h-2.5 inline" />{" "}
                        {(profile.athUsd / profile.atlUsd).toFixed(0)}x from low
                      </span>
                    ) : undefined
                  }
                />
                <Stat
                  label="CIRCULATING"
                  value={profile.circulatingSupply !== undefined ? fmtSupply(profile.circulatingSupply) : "—"}
                  sub={
                    profile.totalSupply !== undefined && profile.circulatingSupply !== undefined && profile.totalSupply > 0 ? (
                      <span className="text-gray-500">
                        {((profile.circulatingSupply / profile.totalSupply) * 100).toFixed(0)}% of total
                      </span>
                    ) : undefined
                  }
                />
                <Stat
                  label="RANK / GENESIS"
                  value={profile.marketCapRank ? `#${profile.marketCapRank}` : "—"}
                  sub={profile.genesisDate ? <span className="text-gray-500">since {profile.genesisDate}</span> : undefined}
                />
              </div>

              {/* Categories */}
              {profile.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.categories.slice(0, 6).map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded bg-surface-1 border border-surface-border text-[10px] font-mono text-gray-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {profile.description && (
                <p className="text-[11px] font-mono text-gray-400 leading-relaxed">
                  {profile.description.length > PROFILE_DESC_LIMIT
                    ? `${profile.description.slice(0, PROFILE_DESC_LIMIT)}…`
                    : profile.description}
                </p>
              )}

              {/* Links */}
              <div className="flex items-center gap-3 text-[11px] font-mono">
                {profile.homepage && (
                  <a
                    href={profile.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-glow hover:text-cyan-neon underline decoration-dotted flex items-center gap-1"
                  >
                    {new URL(profile.homepage).hostname.replace("www.", "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.twitter && (
                  <a
                    href={`https://x.com/${profile.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-glow hover:text-cyan-neon underline decoration-dotted"
                  >
                    @{profile.twitter}
                  </a>
                )}
                <span className="text-gray-600 ml-auto">via CoinGecko</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: React.ReactNode }> = ({
  label,
  value,
  sub,
}) => (
  <div>
    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    <p className="text-sm font-bold text-gray-100 mt-0.5">{value}</p>
    {sub && <p className="text-[10px] font-mono mt-0.5">{sub}</p>}
  </div>
);

function fmtPrice(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(4)}`;
}

function fmtSupply(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(0);
}
