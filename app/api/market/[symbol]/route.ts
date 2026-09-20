import { NextRequest, NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol;
    const provider = providerRegistry.getMarketProvider();

    if (!provider) {
      return NextResponse.json(
        { error: "No market provider configured" },
        { status: 503 }
      );
    }

    const result = await provider.getTokenMarketData({ symbol });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
