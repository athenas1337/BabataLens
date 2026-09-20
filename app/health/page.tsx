"use client";

import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { ProviderHealthReport } from "@/lib/providers/interfaces";

export default function HealthPage() {
  const [reports, setReports] = useState<ProviderHealthReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/providers/health");
      const json = await res.json();
      setReports(json.providers || []);
      setLastCheck(new Date(json.timestamp || Date.now()).toLocaleTimeString());
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        );
      case "configured":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3.5 h-3.5" />
            Configured
          </span>
        );
      case "degraded":
      case "rate_limited":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            <span>Provider Health & Diagnostics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Status konektivitas dan latensi real-time seluruh provider tanpa paparan kredensial.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#131C30] hover:bg-[#1E2C4A] border border-[#1E2C4A] text-xs font-medium text-slate-200 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {lastCheck && (
        <p className="text-[11px] text-slate-500 font-mono">Pemeriksaan terakhir: {lastCheck}</p>
      )}

      {/* Provider List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((p) => (
          <div
            key={p.provider}
            className="p-5 rounded-2xl bg-[#0E1524] border border-[#1E2C4A] shadow-lg flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white capitalize font-mono">{p.provider}</h3>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Capability: {p.capability}
                </span>
              </div>
              {getStatusBadge(p.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#1E2C4A]/50">
              <div>
                <span className="text-[10px] text-slate-500 uppercase">Latency</span>
                <p className="font-mono text-slate-300 font-semibold">
                  {p.latencyMs ? `${p.latencyMs} ms` : "—"}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase">Security Check</span>
                <p className="font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Key Redacted
                </p>
              </div>
            </div>

            {p.errorMessage && (
              <p className="text-[11px] text-slate-400 bg-[#131C30] p-2 rounded-lg font-mono">
                Note: {p.errorMessage}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
