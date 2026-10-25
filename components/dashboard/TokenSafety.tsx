"use client";

import React, { useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, ScanSearch } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

type RiskLevel = "high" | "medium" | "low" | "info";

interface SecurityFlag {
  label: string;
  level: RiskLevel;
}
interface TokenSecurityReport {
  riskLevel: RiskLevel;
  summary: string;
  honeypot: boolean | null;
  openSource: boolean | null;
  mintable: boolean | null;
  buyTaxPct?: number;
  sellTaxPct?: number;
  holderCount?: number;
  flags: SecurityFlag[];
}

const SCAN_CHAINS = [
  { id: 1, label: "Ethereum" },
  { id: 56, label: "BNB Chain" },
  { id: 137, label: "Polygon" },
  { id: 42161, label: "Arbitrum" },
  { id: 10, label: "Optimism" },
  { id: 8453, label: "Base" },
  { id: 43114, label: "Avalanche" },
];

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const LEVEL_STYLES: Record<RiskLevel, string> = {
  high: "text-rose-flare bg-rose-flare/10 border-rose-flare/40",
  medium: "text-amber-glow bg-amber-glow/10 border-amber-glow/40",
  low: "text-emerald-cyber bg-emerald-cyber/10 border-emerald-cyber/40",
  info: "text-gray-300 bg-surface-1 border-surface-border",
};

/**
 * TokenSafety — free honeypot/rugcheck scan for an ERC-20 contract (GoPlus
 * Security public API). Honesty contract: absent flags are not proof of
 * safety, and an unreachable scanner is shown as such, never as "safe".
 */
export const TokenSafety: React.FC = () => {
  const [chainId, setChainId] = useState(1);
  const [address, setAddress] = useState("");
  const [report, setReport] = useState<TokenSecurityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    const addr = address.trim();
    if (!EVM_ADDRESS_RE.test(addr)) {
      setError("Enter a valid contract address (0x…, 40 hex characters).");
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await apiFetch(
        `/api/security/token?chainId=${chainId}&address=${encodeURIComponent(addr)}`
      );
      const json = (await res.json()) as { data?: TokenSecurityReport; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error || `HTTP ${res.status}`);
      setReport(json.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Scanner unavailable — try again shortly"
      );
    } finally {
      setLoading(false);
    }
  };

  const RiskIcon =
    report?.riskLevel === "high" ? ShieldX : report?.riskLevel === "medium" ? ShieldAlert : ShieldCheck;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 pb-4">
      <div className="p-5 rounded-xl glass-hud border-surface-border">
        <div className="flex items-center gap-2 mb-2">
          <ScanSearch className="w-4 h-4 text-cyan-neon" />
          <h3 className="text-sm font-bold font-mono text-cyan-neon">TOKEN SAFETY SCANNER</h3>
        </div>
        <p className="text-xs text-gray-400 font-mono mb-4 leading-relaxed">
          Paste a token contract to check for honeypots, trade taxes and owner capabilities before
          you trade it. Free via the GoPlus Security public API.{" "}
          <span className="text-amber-glow">A clean scan is not financial safety — verify independently.</span>
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void scan();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="px-3 py-2.5 rounded-xl bg-surface-1 border border-surface-border text-xs font-mono text-gray-200 outline-none focus:border-cyan-neon"
          >
            {SCAN_CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… token contract address"
            spellCheck={false}
            className="flex-1 px-3 py-2.5 rounded-xl bg-surface-1 border border-surface-border text-xs font-mono text-gray-200 outline-none focus:border-cyan-neon"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-cyan-neon/15 border border-cyan-neon/40 text-cyan-neon text-xs font-mono font-bold hover:bg-cyan-neon/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
            SCAN
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-amber-glow/10 border border-amber-glow/30 text-amber-glow text-xs font-mono">
            {error}
          </div>
        )}

        {report && (
          <div className="mt-4 space-y-3">
            <div className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${LEVEL_STYLES[report.riskLevel]}`}>
              <RiskIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold uppercase tracking-wide">
                  Risk: {report.riskLevel === "info" ? "unscanned" : report.riskLevel}
                </p>
                <p className="mt-0.5 text-gray-200">{report.summary}</p>
              </div>
            </div>

            {report.flags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {report.flags.map((f, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded text-[11px] font-mono border ${LEVEL_STYLES[f.level]}`}
                  >
                    {f.label}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-gray-400">
              <span>
                Source:{" "}
                <span className={report.openSource === false ? "text-rose-flare" : "text-gray-200"}>
                  {report.openSource === null ? "unknown" : report.openSource ? "verified" : "NOT verified"}
                </span>
              </span>
              {report.buyTaxPct !== undefined && (
                <span>
                  Buy tax: <span className="text-gray-200">{report.buyTaxPct.toFixed(1)}%</span>
                </span>
              )}
              {report.sellTaxPct !== undefined && (
                <span>
                  Sell tax: <span className="text-gray-200">{report.sellTaxPct.toFixed(1)}%</span>
                </span>
              )}
              {report.holderCount !== undefined && (
                <span>
                  Holders: <span className="text-gray-200">{report.holderCount.toLocaleString()}</span>
                </span>
              )}
              {report.mintable !== null && (
                <span>
                  Mintable:{" "}
                  <span className={report.mintable ? "text-amber-glow" : "text-gray-200"}>
                    {report.mintable ? "yes" : "no"}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
