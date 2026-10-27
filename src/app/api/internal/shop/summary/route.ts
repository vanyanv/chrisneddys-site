import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";
import { getShopSummary } from "@/lib/shopSummary";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/summary[?days=N] — see `ShopSummary`. */
export const GET = withInternalAuth(async (request) => {
  const raw = new URL(request.url).searchParams.get("days");
  let days: number | undefined;
  if (raw !== null) {
    days = Number(raw);
    if (!/^\d+$/.test(raw) || days < 1 || days > 90) {
      return internalError("days must be a whole number from 1 to 90.");
    }
  }
  return internalJson(await getShopSummary({ days }));
});
