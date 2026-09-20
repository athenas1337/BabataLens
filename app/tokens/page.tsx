"use client";

import React, { useState } from "react";
import { Coins, Search, ShieldCheck, FileCode, CheckCircle2 } from "lucide-react";
import { ContractInfo } from "@/lib/providers/interfaces";

export default function TokensPage() {
  const [address, setAddress] = useState("0xdAC17F958D2ee523a2206206994597C13D831ec7"); // Tether USDT
  const [network, setNetwork] = useState("ethereum");
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/token/${network}/${address.trim()}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data kontrak token.");
      }
      const json = await res.json();
      setContractInfo(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pemeriksaan token gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Coins className="w-6 h-6 text-purple-400" />
          <span>Tokens & Smart Contracts</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspeksi validitas kontrak, compiler version, dan status verifikasi kode on-chain.
        </p>
      </div>

      <div className="bg-[#0E1524] p-4 sm:p-5 rounded-2xl border border-[#1E2C4A] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Contract Address (0x...)..."
            className="flex-1 bg-[#131C30] border border-[#1E2C4A] focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono outline-none"
          />

          <button
            onClick={handleInspect}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors shrink-0 disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Inspeksi Kontrak"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {contractInfo && (
        <div className="bg-[#0E1524] rounded-2xl border border-[#1E2C4A] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2C4A]">
            <div className="flex items-center gap-3">
              <FileCode className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-lg font-bold text-white">{contractInfo.name || "Smart Contract"}</h3>
                <p className="text-xs font-mono text-slate-400">{contractInfo.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{contractInfo.isVerified ? "Verified Contract" : "Unverified"}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-[#131C30] rounded-xl border border-[#1E2C4A]">
              <span className="text-slate-400">Network</span>
              <p className="text-sm font-semibold text-slate-100 mt-1 capitalize">{contractInfo.network}</p>
            </div>
            <div className="p-3 bg-[#131C30] rounded-xl border border-[#1E2C4A]">
              <span className="text-slate-400">Compiler</span>
              <p className="text-sm font-semibold text-slate-100 mt-1">{contractInfo.compilerVersion || "EVM Standard"}</p>
            </div>
            <div className="p-3 bg-[#131C30] rounded-xl border border-[#1E2C4A]">
              <span className="text-slate-400">Audit Status</span>
              <p className="text-sm font-semibold text-emerald-400 mt-1">Read-Only Inspected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
