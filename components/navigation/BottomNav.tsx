"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquareCode,
  TrendingUp,
  Wallet,
  Menu,
  X,
  Coins,
  LineChart,
  Settings,
  Activity,
  Sparkles,
} from "lucide-react";
import { BabataAvatar } from "../babata/Avatar";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const mainItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/chat", label: "Chat", icon: MessageSquareCode },
    { href: "/markets", label: "Markets", icon: TrendingUp },
    { href: "/wallets", label: "Wallets", icon: Wallet },
  ];

  const drawerItems = [
    { href: "/tokens", label: "Tokens & Contracts", icon: Coins, desc: "Token holders & contract details" },
    { href: "/analytics", label: "Dune Analytics", icon: LineChart, desc: "Custom on-chain queries" },
    { href: "/health", label: "Provider Health", icon: Activity, desc: "Status of AI, RPC & API nodes" },
    { href: "/settings", label: "Settings & Keys", icon: Settings, desc: "Configuration & env preferences" },
  ];

  return (
    <>
      {/* Drawer Overlay for Mobile */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-up Drawer for "More" destinations */}
      <div
        className={`fixed bottom-16 inset-x-0 bg-[#0E1524] border-t border-[#1E2C4A] z-[45] rounded-t-2xl p-5 md:hidden transition-transform duration-300 ease-in-out shadow-2xl ${
          isDrawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#1E2C4A]/80">
          <div className="flex items-center gap-3">
            <BabataAvatar size="sm" state="idle" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                More Destinations <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </h3>
              <p className="text-[11px] text-slate-400">Deep blockchain & workspace tools</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close navigation drawer"
            className="p-2 text-slate-400 hover:text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg active:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-3">
          {drawerItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors min-h-[48px] ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-300 hover:bg-[#162036] active:bg-[#1E2C4A]"
                }`}
              >
                <div className="p-2 rounded-lg bg-[#131C30] text-cyan-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[11px] text-slate-400">{item.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-[#0B0F19]/95 backdrop-blur border-t border-[#1E2C4A] z-40 flex items-center justify-around px-2">
        {mainItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 transition-colors ${
                isActive ? "text-cyan-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          aria-expanded={isDrawerOpen}
          aria-label="Open more menu"
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[44px] py-1 transition-colors ${
            isDrawerOpen ? "text-cyan-400" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
};
