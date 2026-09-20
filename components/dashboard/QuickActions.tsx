"use client";

import React from "react";
import Link from "next/link";
import { MessageSquareCode, TrendingUp, Wallet, Activity, ShieldCheck } from "lucide-react";

export const QuickActions: React.FC = () => {
  const actions = [
    {
      title: "Tanya Babata",
      desc: "Diskusi analitis & riset instan",
      href: "/chat",
      icon: MessageSquareCode,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
    },
    {
      title: "Riset Market",
      desc: "Pergerakan harga & perbandingan",
      href: "/markets",
      icon: TrendingUp,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      title: "Lacak Wallet",
      desc: "Saldo & histori transaksi on-chain",
      href: "/wallets",
      icon: Wallet,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Health Provider",
      desc: "Status API, RPC, & latency",
      href: "/health",
      icon: Activity,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((act, i) => {
        const Icon = act.icon;
        return (
          <Link
            key={i}
            href={act.href}
            className={`p-4 rounded-xl bg-[#0E1524] hover:bg-[#131C30] border ${act.border} transition-all duration-200 group active:scale-98`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${act.bg} ${act.color}`}>
                <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
                  {act.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{act.desc}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
