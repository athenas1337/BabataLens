"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareCode,
  TrendingUp,
  Wallet,
  Coins,
  LineChart,
  Settings,
  Activity,
  Sparkles,
} from "lucide-react";
import { BabataAvatar } from "../babata/Avatar";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const mainNav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/chat", label: "AI Chat", icon: MessageSquareCode, badge: "Babata" },
    { href: "/markets", label: "Markets", icon: TrendingUp },
    { href: "/wallets", label: "Wallets", icon: Wallet },
    { href: "/tokens", label: "Tokens", icon: Coins },
    { href: "/analytics", label: "Analytics", icon: LineChart },
  ];

  const secondaryNav = [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/health", label: "Health", icon: Activity },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#0B0F19] border-r border-[#1E2C4A] h-screen sticky top-0 select-none z-30">
      {/* Brand Identity Header */}
      <div className="p-5 border-b border-[#1E2C4A]/70 flex items-center gap-3">
        <BabataAvatar size="sm" state="idle" />
        <div>
          <div className="flex items-center gap-1.5 font-bold text-slate-100 tracking-wide">
            <span>Babata Lens</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Intelligence Workspace</p>
        </div>
      </div>

      {/* Main Nav Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Intelligence
        </p>
        {mainNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131C30]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-5 pb-1">
          <p className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            System
          </p>
        </div>
        {secondaryNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[#131C30]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Operator Session Info Footer */}
      <div className="p-4 border-t border-[#1E2C4A]/70 bg-[#0E1524]/60">
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="text-slate-300 font-medium">Atha</p>
            <p className="text-slate-400 text-[11px]">Primary Operator</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Session Active" />
        </div>
      </div>
    </aside>
  );
};
