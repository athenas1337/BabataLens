"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ShieldCheck } from "lucide-react";
import { BabataAvatar } from "../babata/Avatar";

export const Header: React.FC = () => {
  return (
    <header className="h-14 border-b border-[#1E2C4A]/80 bg-[#0B0F19]/80 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
      {/* Left Branding (Mobile) or Welcome context (Desktop) */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2.5">
          <BabataAvatar size="sm" state="idle" />
          <span className="font-bold text-slate-100 tracking-wide text-sm flex items-center gap-1">
            Babata Lens
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-200 font-medium">Babata Intelligence Engine</span>
          <span>•</span>
          <span className="text-cyan-400 font-medium">Ready for Atha</span>
        </div>
      </div>

      {/* Right Quick Badges */}
      <div className="flex items-center gap-3">
        <Link
          href="/health"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#131C30] border border-[#1E2C4A] text-[11px] text-slate-300 hover:border-cyan-500/40 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Providers</span>
          <span className="text-slate-400 font-mono">Live</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-300">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Server-Side Isolated</span>
        </div>
      </div>
    </header>
  );
};
