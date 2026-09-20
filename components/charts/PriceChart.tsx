"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { PricePoint } from "@/lib/providers/interfaces";

interface PriceChartProps {
  data: PricePoint[];
  symbol?: string;
  isLoading?: boolean;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  symbol = "BTC",
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-[#0E1524]/40 rounded-xl border border-[#1E2C4A] animate-pulse">
        <p className="text-xs text-slate-400">Loading price history...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center bg-[#0E1524]/40 rounded-xl border border-[#1E2C4A] p-4 text-center">
        <p className="text-sm font-medium text-slate-300">No chart data available</p>
        <p className="text-xs text-slate-500 mt-1">
          Historical points will render here once the provider returns market history.
        </p>
      </div>
    );
  }

  const formattedData = data.map((pt) => ({
    time: new Date(pt.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    price: pt.price,
  }));

  const minPrice = Math.min(...data.map((d) => d.price)) * 0.99;
  const maxPrice = Math.max(...data.map((d) => d.price)) * 1.01;

  return (
    <div className="w-full h-64 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `$${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val.toFixed(2)}`}
            width={48}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0];
                return (
                  <div className="bg-[#0B0F19] border border-[#1E2C4A] p-2.5 rounded-lg shadow-xl text-xs">
                    <p className="text-slate-400">{item.payload.time}</p>
                    <p className="text-cyan-400 font-bold mt-0.5">
                      ${Number(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#06B6D4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#priceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
