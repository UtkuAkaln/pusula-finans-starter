import { NextResponse } from "next/server";
import { getMarketPrices } from "@/lib/market-prices";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getMarketPrices(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { snapshot: null, stale: true, unavailable: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
