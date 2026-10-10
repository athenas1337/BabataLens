import { NextRequest, NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";
import { TimeRange } from "@/lib/providers/interfaces";

const VALID_RANGES: TimeRange[] = ["1d", "7d", "30d", "90d", "1y", "all"];

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol;
    const rangeParam = (req.nextUrl.searchParams.get("range") || "7d") as TimeRange;
    const range: TimeRange = VALID_RANGES.includes(rangeParam) ? rangeParam : "7d";

    const provider = providerRegistry.getMarketProvider();
    if (!provider) {
      return NextResponse.json(
        { error: "No market provider configured" },
        { status: 503 }
      );
    }

    const result = await provider.getMarketHistory({ symbol }, range);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch market history" },
      { status: 500 }
    );
  }
}
