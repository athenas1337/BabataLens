/**
 * CSV builders for client-side exports. Pure functions so they can be
 * regression-tested; the download itself stays in the components.
 */

function csvCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : String(value);
  // Quote anything that could break the grid: commas, quotes, newlines.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export interface PortfolioCsvRow {
  symbol: string;
  name?: string;
  coinId: string;
  amount: number;
  priceUsd?: number;
  valueUsd?: number;
  change24hPct?: number;
}

export function toPortfolioCsv(rows: PortfolioCsvRow[]): string {
  return toCsv(
    ["symbol", "name", "coin_id", "amount", "price_usd", "value_usd", "change_24h_pct"],
    rows.map((r) => [
      r.symbol,
      r.name ?? "",
      r.coinId,
      r.amount,
      r.priceUsd ?? "",
      r.valueUsd ?? "",
      r.change24hPct ?? "",
    ])
  );
}

export interface TransactionCsvRow {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  status: string;
  network: string;
}

export function toTransactionsCsv(rows: TransactionCsvRow[]): string {
  return toCsv(
    ["hash", "timestamp", "from", "to", "value", "status", "network"],
    rows.map((r) => [r.hash, r.timestamp, r.from, r.to, r.value, r.status, r.network])
  );
}

/** Trigger a client-side download of `csv` as `filename`. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
