import { describe, it, expect } from "vitest";
import {
  normalizeCoinGeckoToken,
  normalizeCoinGeckoChart,
  normalizeEtherscanBalance,
  normalizeBingXTicker,
  isValidCryptoAddress,
  ProviderValidationError,
} from "../../lib/normalize/schemas";

describe("Normalization & Zod Validation Suite", () => {
  it("successfully normalizes valid CoinGecko market response", () => {
    const raw = {
      id: "bitcoin",
      symbol: "btc",
      name: "Bitcoin",
      market_data: {
        current_price: { usd: 64000 },
        price_change_percentage_24h: 3.5,
        market_cap: { usd: 1250000000000 },
        total_volume: { usd: 28000000000 },
      },
      last_updated: "2026-09-20T12:00:00Z",
    };

    const normalized = normalizeCoinGeckoToken(raw);
    expect(normalized.id).toBe("bitcoin");
    expect(normalized.symbol).toBe("BTC");
    expect(normalized.currentPriceUsd).toBe(64000);
    expect(normalized.priceChange24hPercent).toBe(3.5);
  });

  it("throws ProviderValidationError on malformed CoinGecko response", () => {
    const malformed = {
      id: 12345, // invalid type: should be string
      symbol: "btc",
    };

    expect(() => normalizeCoinGeckoToken(malformed)).toThrow(ProviderValidationError);
  });

  it("successfully normalizes valid Etherscan balance", () => {
    const raw = {
      status: "1",
      message: "OK",
      result: "5000000000000000000", // 5 ETH in wei
    };

    const normalized = normalizeEtherscanBalance(raw, "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ethereum");
    expect(normalized.nativeBalanceFormatted).toBe(5);
    expect(normalized.nativeSymbol).toBe("ETH");
  });

  it("throws ProviderValidationError on Etherscan failure status", () => {
    const raw = {
      status: "0",
      message: "NOTOK",
      result: "Error! Invalid address format",
    };

    expect(() =>
      normalizeEtherscanBalance(raw, "0x123", "ethereum")
    ).toThrow(ProviderValidationError);
  });

  it("successfully normalizes BingX ticker payload", () => {
    const raw = {
      code: 0,
      data: {
        symbol: "BTC-USDT",
        lastPrice: "64500.5",
        highPrice: "65000",
        lowPrice: "63000",
        volume: "1200",
        priceChangePercent: "2.3",
      },
    };

    const normalized = normalizeBingXTicker(raw);
    expect(normalized.symbol).toBe("BTC-USDT");
    expect(normalized.lastPrice).toBe(64500.5);
    expect(normalized.priceChangePercent24h).toBe(2.3);
  });

  it("correctly validates EVM and Solana crypto addresses", () => {
    expect(isValidCryptoAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ethereum")).toBe(true);
    expect(isValidCryptoAddress("0xinvalidaddress", "ethereum")).toBe(false);

    expect(isValidCryptoAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", "solana")).toBe(true);
    expect(isValidCryptoAddress("0xnotSolana", "solana")).toBe(false);
  });
});
