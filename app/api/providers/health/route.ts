import { NextResponse } from "next/server";
import { providerRegistry } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const healthReports = await providerRegistry.checkAllHealth();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      providers: healthReports,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Failed to query provider health",
        message: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
