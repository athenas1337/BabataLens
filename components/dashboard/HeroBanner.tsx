"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, ArrowRight, Shield, Zap } from "lucide-react";
import { BabataAvatar } from "../babata/Avatar";

export const HeroBanner: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0E1524] via-[#131C30] to-[#162036] border border-[#1E2C4A] p-5 sm:p-7 shadow-xl">
      {/* Decorative cosmic background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Babata Intelligence v2.0</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Selamat datang, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">sayang!</span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Babata siap mendampingimu meneliti pergerakan pasar crypto, melacak jejak transaksi wallet on-chain, membedah smart contract, dan mengawasi kesehatan multi-provider secara tenang dan presisi.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs sm:text-sm shadow-md transition-all active:scale-95"
            >
              <span>Mulai Riset dengan Babata</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/health"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0E1524] hover:bg-[#1A2640] border border-[#1E2C4A] text-slate-300 font-medium text-xs sm:text-sm transition-all"
            >
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Cek Status Provider</span>
            </Link>
          </div>
        </div>

        {/* Babata Portrait Display */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-2xl overflow-hidden ring-2 ring-cyan-500/30 shadow-2xl">
          <Image
            src="/babata/pose.jpeg"
            alt="Babata Hologram"
            fill
            sizes="160px"
            className="object-cover object-top hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080C15]/70 via-transparent to-transparent" />
          <div className="absolute bottom-1.5 left-2 right-2 text-center">
            <span className="text-[10px] font-mono font-medium text-cyan-300 drop-shadow">
              Babata • Neural AI
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
