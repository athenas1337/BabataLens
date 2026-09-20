import { NextRequest, NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: { network: string; hash: string } }
) {
  try {
    const { network, hash } = params;
    const provider = providerRegistry.getBlockchainProvider(network);

    if (!provider) {
      return NextResponse.json(
        { error: `No blockchain provider configured for network '${network}'` },
        { status: 503 }
      );
    }

    const txDetail = await provider.getTransactionInformation(hash, network);
    return NextResponse.json(txDetail);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to inspect transaction" },
      { status: 500 }
    );
  }
}
