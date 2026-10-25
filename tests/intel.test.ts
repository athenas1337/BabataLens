import { describe, it, expect } from "vitest";
import {
  mapTrending,
  topByTvl,
  pickStablecoinTop,
  pickStableYields,
  assessTokenSecurity,
  assessAddressSecurity,
  isSupportedSecurityChain,
} from "../lib/providers/market/intel";

describe("Market & DeFi intel mappers (pure)", () => {
  it("maps CoinGecko trending items into lean CoinSummary-shaped rows", () => {
    const rows = mapTrending({
      coins: [
        {
          item: {
            id: "hyperliquid",
            symbol: "hype",
            name: "Hyperliquid",
            market_cap_rank: 11,
            data: {
              price: 76.01,
              price_change_percentage_24h: { usd: -0.15 },
            },
          },
        },
        {
          item: {
            id: "zcash",
            symbol: "ZEC",
            name: "Zcash",
            market_cap_rank: null,
          },
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "hyperliquid",
      symbol: "HYPE",
      name: "Hyperliquid",
      rank: 11,
      priceUsd: 76.01,
      change24hPct: -0.15,
    });
    expect(rows[1].priceUsd).toBeUndefined();
    expect(rows[1].rank).toBeUndefined();
  });

  it("throws on a trending payload that lost its shape", () => {
    expect(() => mapTrending({ coins: "oops" })).toThrow(/unexpected data/);
  });

  it("ranks chains/protocols by TVL and drops zero rows", () => {
    const rows = topByTvl(
      [
        { name: "Empty", tvl: 0 },
        { name: "Small", tvl: 5 },
        { name: "Big", tvl: 100 },
        { name: "Broken", tvl: null },
      ],
      2
    );
    expect(rows).toEqual([
      { name: "Big", tvlUsd: 100 },
      { name: "Small", tvlUsd: 5 },
    ]);
  });

  it("extracts stablecoin leaders and honors the endpoint total", () => {
    const { totalUsd, top } = pickStablecoinTop({
      totalCirculatingUSD: { peggedUSD: 300 },
      peggedAssets: [
        { name: "Tether", symbol: "USDT", circulating: { peggedUSD: 180 } },
        { name: "USD Coin", symbol: "USDC", circulating: { peggedUSD: 110 } },
        { name: "Broken", symbol: "X", circulating: { peggedUSD: null } },
      ],
    });
    expect(totalUsd).toBe(300);
    expect(top).toEqual([
      { symbol: "USDT", name: "Tether", usd: 180 },
      { symbol: "USDC", name: "USD Coin", usd: 110 },
    ]);
  });

  it("falls back to summing leaders when the total is missing", () => {
    const { totalUsd } = pickStablecoinTop({
      peggedAssets: [{ name: "Tether", symbol: "USDT", circulating: { peggedUSD: 42 } }],
    });
    expect(totalUsd).toBe(42);
  });

  it("filters stable yields to real pools and sorts by APY", () => {
    const pools = pickStableYields({
      data: [
        { project: "a", chain: "Ethereum", symbol: "USDC", tvlUsd: 5e6, apy: 99, stablecoin: true }, // TVL too low? no—5e6 < 10e6 → dropped
        { project: "b", chain: "Ethereum", symbol: "USDC", tvlUsd: 5e7, apy: 4.2, stablecoin: true },
        { project: "c", chain: "Base", symbol: "USDC", tvlUsd: 2e7, apy: 11.5, stablecoin: true },
        { project: "d", chain: "Solana", symbol: "JLP", tvlUsd: 5e7, apy: 60, stablecoin: false }, // not stable
        { project: "e", chain: "Ethereum", symbol: "USDT", tvlUsd: 3e7, apy: null, stablecoin: true }, // no apy
        { project: "f", chain: "BSC", symbol: "USDT", tvlUsd: 1e8, apy: 250, stablecoin: true }, // implausible apy
      ],
    });
    expect(pools.map((p) => p.project)).toEqual(["c", "b"]);
    expect(pools[0].apyPct).toBeCloseTo(11.5);
  });

  it("rates honeypots as high risk regardless of other fields", () => {
    const report = assessTokenSecurity("0xabc", 1, {
      honeypot: { status: "1" },
      is_open_source: "1",
      is_mintable: "0",
      buy_tax: "0.02",
      sell_tax: "0.9",
      holder_count: "1234",
    });
    expect(report.riskLevel).toBe("high");
    expect(report.honeypot).toBe(true);
    expect(report.buyTaxPct).toBeCloseTo(2);
    expect(report.sellTaxPct).toBeCloseTo(90);
    expect(report.flags.some((f) => /HONEYPOT/.test(f.label))).toBe(true);
  });

  it("flags unverified source and mint rights without inventing taxes", () => {
    const report = assessTokenSecurity("0xabc", 1, {
      is_open_source: "0",
      is_mintable: "1",
    });
    expect(report.riskLevel).toBe("high");
    expect(report.openSource).toBe(false);
    expect(report.mintable).toBe(true);
    expect(report.buyTaxPct).toBeUndefined();
  });

  it("treats a clean verified token as low risk", () => {
    const report = assessTokenSecurity("0xabc", 1, {
      honeypot: "0",
      is_open_source: "1",
      is_mintable: "0",
      buy_tax: "0",
      sell_tax: "0",
    });
    expect(report.riskLevel).toBe("low");
    expect(report.flags).toHaveLength(0);
  });

  it("never promotes unknown shapes to a clean bill of health", () => {
    const report = assessTokenSecurity("0xabc", 1, { unexpected: true });
    expect(report.riskLevel).toBe("low");
    expect(report.honeypot).toBeNull();
    expect(report.openSource).toBeNull();
    expect(report.summary).toMatch(/unavailable|independently/i);
  });

  it("surfaces money-laundering flags on addresses", () => {
    const report = assessAddressSecurity("0xdef", {
      is_contract: "0",
      is_money_laundering: "1",
      is_blacklisted: "0",
    });
    expect(report.riskLevel).toBe("high");
    expect(report.isContract).toBe(false);
  });

  it("gates GoPlus chains to the supported set", () => {
    expect(isSupportedSecurityChain(1)).toBe(true);
    expect(isSupportedSecurityChain(8453)).toBe(true);
    expect(isSupportedSecurityChain(999)).toBe(false);
  });
});
