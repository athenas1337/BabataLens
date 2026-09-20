import { NextRequest, NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";
import { isValidCryptoAddress } from "@/lib/normalize/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: { network: string; address: string } }
) {
  try {
    const { network, address } = params;

    if (!isValidCryptoAddress(address, network)) {
      return NextResponse.json(
        { error: `Invalid address format for network '${network}'` },
        { status: 400 }
      );
    }

    const provider = providerRegistry.getBlockchainProvider(network);
    if (!provider) {
      return NextResponse.json(
        { error: `No blockchain provider configured for network '${network}'` },
        { status: 503 }
      );
    }

    const [balanceRes, txRes] = await Promise.allSettled([
      provider.getWalletBalance(address, network),
      provider.getWalletTransactions(address, network, { pageSize: 10 }),
    ]);

    return NextResponse.json({
      balance: balanceRes.status === "fulfilled" ? balanceRes.value : null,
      transactions: txRes.status === "fulfilled" ? txRes.value : null,
      network,
      address,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch wallet info" },
      { status: 500 }
    );
  }
}
