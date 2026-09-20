"use client";

import React, { useState } from "react";
import { Settings, Key, Shield, Copy, Check, Info } from "lucide-react";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const envTemplate = `# --- AI Keys ---
GOOGLE_AI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=

# --- Market Keys ---
COINGECKO_API_KEY=
COINMARKETCAP_API_KEY=

# --- Blockchain Keys ---
ETHERSCAN_API_KEY=
ALCHEMY_API_KEY=
SOLSCAN_API_KEY=

# --- Analytics & Exchange ---
DUNE_API_KEY=
BINGX_API_KEY=
BINGX_API_SECRET=

# --- Database & Cache ---
DATABASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
AUTH_SECRET=`;

  const handleCopy = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" />
          <span>Pengaturan & Panduan API Key</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Panduan aman lokasi dan konfigurasi API key untuk Babata Lens.
        </p>
      </div>

      {/* Guidance Alert */}
      <div className="bg-[#0E1524] rounded-2xl border border-[#1E2C4A] p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-cyan-400">
          <Key className="w-5 h-5" />
          <h2 className="text-sm font-bold text-slate-100">Di Mana Menyimpan API Key?</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-[#131C30] border border-[#1E2C4A] space-y-1">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              1. Saat Menjalankan Lokal (Development)
            </h3>
            <p className="text-slate-400">
              Buat file bernama <code className="text-cyan-300 bg-[#080C15] px-1.5 py-0.5 rounded font-mono">.env.local</code> di folder utama proyek (root). File ini sudah otomatis dimasukkan ke <code className="text-slate-300 font-mono">.gitignore</code> sehingga <strong>TIDAK AKAN PERNAH</strong> ter-push ke GitHub.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#131C30] border border-[#1E2C4A] space-y-1">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              2. Saat Deployment di Cloud (Vercel / Netlify / VPS)
            </h3>
            <p className="text-slate-400">
              Simpan kunci-kunci tersebut pada menu <strong>Environment Variables</strong> di dashboard platform hosting (misal: <em>Project Settings → Environment Variables</em> di Vercel).
            </p>
          </div>
        </div>

        {/* Template Code Block */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Template Isi .env.local:</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 bg-[#131C30] px-2.5 py-1 rounded-lg border border-[#1E2C4A] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Tersalin!" : "Salin Template"}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#080C15] border border-[#1E2C4A] text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {envTemplate}
          </pre>
        </div>
      </div>
    </div>
  );
}
