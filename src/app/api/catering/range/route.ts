/**
 * POST /api/catering/range
 *
 * The delivery-range check the order builder calls as the customer types a
 * ZIP, ahead of checkout's own (authoritative) re-check of the same thing.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getCateringSettings } from "@/lib/catering/settings";
import { estimateMiles, inRange } from "@/lib/catering/range";
import { isCateringStoreId } from "@/lib/catering/stores";
import { locations } from "@/data/locations";
import { getDb } from "@/db/client";

export const runtime = "nodejs";

function storeZip(storeId: string): string {
  return locations.find((l) => l.id === storeId)?.postal ?? "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const raw = await request.json().catch(() => null);
  const store =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).store : null;
  const zip = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).zip : null;

  if (typeof store !== "string" || !isCateringStoreId(store) || typeof zip !== "string" || !zip) {
    return NextResponse.json({ miles: null, inRange: false, unknown: true }, { status: 400 });
  }

  const settings = await getCateringSettings(await getDb());
  const miles = estimateMiles(storeZip(store), zip);
  const unknown = miles === null;

  return NextResponse.json({
    miles,
    inRange: unknown ? false : inRange(miles, settings.rangeMiles),
    unknown,
  });
}
