import { NextRequest, NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: { network: string; address: string } }
) {
  try {
    const { network, address } = params;
    const provider = providerRegistry.getBlockchainProvider(network);

    if (!provider) {
      return NextResponse.json(
        { error: `No blockchain provider configured for network '${network}'` },
        { status: 503 }
      );
    }

    const contractInfo = await provider.getContractInformation(address, network);
    return NextResponse.json(contractInfo);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch contract metadata" },
      { status: 500 }
    );
  }
}
