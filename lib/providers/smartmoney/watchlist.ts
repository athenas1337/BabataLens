/**
 * Default watchlist for the Live Flows view.
 *
 * Honesty contract: only addresses whose ownership is public knowledge and
 * widely published (official disclosures, exchange-labeled hot wallets) belong
 * here. This is NOT a "smart trader" list — the UI presents these as
 * publicly-known entity wallets. Users add their own addresses in the UI or
 * via the SMART_MONEY_WATCHLIST env var.
 */
export interface WatchedWallet {
  address: string;
  label: string;
  type: string;
  /** Where the label claim comes from, shown to end users for verification. */
  source: string;
}

/** Ethereum-mainnet public entity addresses (blockscout hosts, not chain-bound). */
export const DEFAULT_WATCHLIST: WatchedWallet[] = [
  {
    address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
    label: "Ethereum Foundation",
    type: "Foundation",
    source: "Public donation address published on ethereum.org",
  },
  {
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    label: "Vitalik Buterin",
    type: "Founder",
    source: "Publicly known primary wallet (vitalik.eth)",
  },
  {
    address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    label: "Binance Hot Wallet 7",
    type: "Exchange",
    source: "Exchange-labeled hot wallet (block explorers)",
  },
];

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function isValidEvmAddress(value: string): boolean {
  return EVM_ADDRESS.test(value.trim());
}

/**
 * Parse SMART_MONEY_WATCHLIST (JSON array of {address,label,type}) defensively.
 * Invalid entries are skipped, never thrown — a bad env var must not take the
 * endpoint down.
 */
export function envWatchlist(): WatchedWallet[] {
  const raw = process.env.SMART_MONEY_WATCHLIST;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is { address: string; label?: string; type?: string } =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as { address?: unknown }).address === "string" &&
          isValidEvmAddress((e as { address: string }).address)
      )
      .map((e) => ({
        address: e.address.trim(),
        label: (e.label || "").toString().slice(0, 40) || `Wallet ${e.address.slice(0, 8)}`,
        type: (e.type || "").toString().slice(0, 24) || "Watched",
        source: "SMART_MONEY_WATCHLIST env var",
      }));
  } catch {
    return [];
  }
}
