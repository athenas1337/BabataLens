import { describe, it, expect } from "vitest";
import { toPortfolioCsv, toTransactionsCsv } from "../lib/utils/csv";

describe("CSV builders", () => {
  it("renders a clean grid with numbers unquoted", () => {
    const csv = toPortfolioCsv([
      {
        symbol: "BTC",
        name: "Bitcoin",
        coinId: "bitcoin",
        amount: 0.5,
        priceUsd: 80317.5,
        valueUsd: 40158.75,
        change24hPct: -0.4,
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("symbol,name,coin_id,amount,price_usd,value_usd,change_24h_pct");
    expect(lines[1]).toBe("BTC,Bitcoin,bitcoin,0.5,80317.5,40158.75,-0.4");
  });

  it("quotes cells containing commas, quotes and newlines (injection-safe)", () => {
    const csv = toTransactionsCsv([
      {
        hash: "0xabc",
        timestamp: "2026-10-25T00:00:00Z",
        from: 'evil",\ninserted_row',
        to: "0xdef",
        value: 'fee 0.001 SOL "quoted"',
        status: "success",
        network: "solana",
      },
    ]);
    const lines = csv.split("\r\n");
    // The evil cell must stay inside one quoted field: the whole row is 2 lines.
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"evil"",\ninserted_row"');
    expect(lines[1]).toContain('"fee 0.001 SOL ""quoted"""');
  });

  it("renders empty cells for missing optional values", () => {
    const csv = toPortfolioCsv([
      { symbol: "GHOST", coinId: "ghost", amount: 3 },
    ]);
    expect(csv.split("\r\n")[1]).toBe("GHOST,,ghost,3,,,");
  });
});
