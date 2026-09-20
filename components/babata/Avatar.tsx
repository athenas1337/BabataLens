"use client";

import React from "react";
import Image from "next/image";

export type AvatarState =
  | "idle"
  | "thinking"
  | "searching"
  | "analyzing"
  | "success"
  | "warning"
  | "error"
  | "offline";

interface BabataAvatarProps {
  state?: AvatarState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const BabataAvatar: React.FC<BabataAvatarProps> = ({
  state = "idle",
  size = "md",
  className = "",
}) => {
  const sizeMap = {
    sm: "w-9 h-9",
    md: "w-12 h-12",
    lg: "w-20 h-20",
    xl: "w-32 h-32",
  };

  const ringGlowMap: Record<AvatarState, string> = {
    idle: "ring-sky-500/40 shadow-sky-500/20",
    thinking: "ring-indigo-500/70 shadow-indigo-500/30 animate-pulse",
    searching: "ring-cyan-400/80 shadow-cyan-400/30 animate-spin",
    analyzing: "ring-purple-500/80 shadow-purple-500/40 animate-pulse",
    success: "ring-emerald-500/60 shadow-emerald-500/30",
    warning: "ring-amber-500/70 shadow-amber-500/30",
    error: "ring-rose-500/70 shadow-rose-500/30",
    offline: "ring-slate-600/40 opacity-70",
  };

  const statusDotMap: Record<AvatarState, string> = {
    idle: "bg-sky-400",
    thinking: "bg-indigo-400 animate-ping",
    searching: "bg-cyan-300 animate-pulse",
    analyzing: "bg-purple-400 animate-pulse",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    error: "bg-rose-500",
    offline: "bg-slate-500",
  };

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <div
        className={`relative overflow-hidden rounded-full ring-2 shadow-lg transition-all duration-300 ${sizeMap[size]} ${ringGlowMap[state]}`}
      >
        <Image
          src="/babata/avatar.jpeg"
          alt="Babata AI Avatar"
          fill
          sizes="128px"
          className="object-cover object-top"
          priority
        />
        {/* Subtle holographic cosmic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/20 via-transparent to-cyan-500/10 pointer-events-none" />
      </div>

      {/* Live status badge indicator */}
      <span
        className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full ring-2 ring-[#080C15] ${statusDotMap[state]}`}
        title={`Status: ${state}`}
      />
    </div>
  );
};
