"use client";

import React, { useState } from "react";
import { Wallet, Copy, Check, ExternalLink, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { WalletBalance, Transaction } from "@/lib/providers/interfaces";

export default function WalletsPage() {
  const [address, setAddress] = useState("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  const [network, setNetwork] = useState("ethereum");
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInspect = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/wallet/${network}/${address.trim()}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Gagal memeriksa wallet.");
      }
      const json = await res.json();
      setBalance(json.balance?.data || null);
      setTransactions(json.transactions?.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Pemeriksaan wallet gagal.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-emerald-400" />
          <span>Wallet On-Chain Inspector</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspeksi saldo native, token holdings, dan histori transaksi on-chain dengan atribusi faktual.
        </p>
      </div>

      {/* Wallet Query Form */}
      <div className="bg-[#0E1524] p-4 sm:p-5 rounded-2xl border border-[#1E2C4A] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="bg-[#131C30] border border-[#1E2C4A] text-xs text-slate-200 rounded-xl px-3 py-2.5 outline-none"
          >
            <option value="ethereum">Ethereum (EVM)</option>
            <option value="solana">Solana (SOL)</option>
            <option value="polygon">Polygon</option>
            <option value="arbitrum">Arbitrum</option>
          </select>

          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address (0x... atau base58)..."
            className="flex-1 bg-[#131C30] border border-[#1E2C4A] focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono outline-none"
          />

          <button
            onClick={handleInspect}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shrink-0 disabled:opacity-50"
          >
            {loading ? "Memeriksa..." : "Inspeksi Wallet"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Balance Details */}
      {balance && (
        <div className="bg-[#0E1524] rounded-2xl border border-[#1E2C4A] p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E2C4A]/70">
            <div>
              <span className="text-[11px] text-slate-400">Address Target</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs sm:text-sm text-cyan-300 break-all">
                  {balance.address}
                </span>
                <button
                  onClick={() => copyToClipboard(balance.address)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy address"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-[#131C30] border border-[#1E2C4A] text-slate-300 text-xs font-mono self-start sm:self-auto">
              Network: {balance.network.toUpperCase()}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#131C30]/80 border border-[#1E2C4A]">
            <span className="text-xs text-slate-400">Saldo Native</span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
              {balance.nativeBalanceFormatted.toFixed(5)} {balance.nativeSymbol}
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length > 0 && (
        <div className="bg-[#0E1524] rounded-2xl border border-[#1E2C4A] p-5 shadow-xl space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Transaksi Terbaru</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2C4A] text-slate-400 font-mono">
                  <th className="pb-2">Tx Hash</th>
                  <th className="pb-2">Block</th>
                  <th className="pb-2">From</th>
                  <th className="pb-2">To</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2C4A]/50">
                {transactions.map((tx) => (
                  <tr key={tx.hash} className="hover:bg-[#131C30]/50 transition-colors font-mono">
                    <td className="py-2.5 text-cyan-400">
                      <span title={tx.hash}>
                        {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400">{tx.blockNumber}</td>
                    <td className="py-2.5 text-slate-300">
                      {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                    </td>
                    <td className="py-2.5 text-slate-300">
                      {tx.to ? `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : "Contract Creation"}
                    </td>
                    <td className="py-2.5 text-right text-slate-200 font-bold">
                      {tx.valueFormatted.toFixed(4)} {tx.symbol}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          tx.status === "success"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
