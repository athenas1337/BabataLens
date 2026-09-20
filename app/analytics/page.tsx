"use client";

import React, { useState } from "react";
import { LineChart, Play, Database, Activity } from "lucide-react";

export default function AnalyticsPage() {
  const [queryId, setQueryId] = useState("1215383"); // DEX metrics
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      // In real scenario triggers Dune query
      setTimeout(() => {
        setResult({
          columns: ["day", "dex_volume_usd", "unique_traders"],
          rows: [
            { day: "2026-09-18", dex_volume_usd: 1420500000, unique_traders: 82400 },
            { day: "2026-09-19", dex_volume_usd: 1680200000, unique_traders: 89100 },
            { day: "2026-09-20", dex_volume_usd: 1530900000, unique_traders: 84300 },
          ],
          rowCount: 3,
          executionTimeMs: 340,
        });
        setLoading(false);
      }, 600);
    } catch (e: any) {
      setError(e.message || "Failed to execute query");
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <LineChart className="w-6 h-6 text-cyan-400" />
          <span>Dune On-Chain Analytics</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Eksekusi kueri analitik blockchain terdesentralisasi melalui integrasi resmi Dune Provider.
        </p>
      </div>

      <div className="bg-[#0E1524] p-5 rounded-2xl border border-[#1E2C4A] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            placeholder="Dune Query ID (misal: 1215383)..."
            className="flex-1 bg-[#131C30] border border-[#1E2C4A] focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono outline-none"
          />

          <button
            onClick={handleRunQuery}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? "Menjalankan..." : "Jalankan Query"}</span>
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-[#0E1524] rounded-2xl border border-[#1E2C4A] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-[#1E2C4A]">
            <span>Query Results: {result.rowCount} rows</span>
            <span>Execution time: {result.executionTimeMs}ms</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#1E2C4A] text-slate-400 font-mono">
                  {result.columns.map((c: string) => (
                    <th key={c} className="pb-2 capitalize">
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2C4A]/50">
                {result.rows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-[#131C30]/50 font-mono">
                    {result.columns.map((c: string) => (
                      <td key={c} className="py-2.5 text-slate-200">
                        {typeof row[c] === "number" ? row[c].toLocaleString() : String(row[c])}
                      </td>
                    ))}
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
