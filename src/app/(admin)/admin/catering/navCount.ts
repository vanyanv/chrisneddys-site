/**
 * The "Catering" nav tab's red count badge — every admin page's own `NAV`
 * array reads this to show how many catering requests need the owner's
 * reply (a `requested` order, or a `booked` order carrying a pending
 * change), the same set `/admin/catering/`'s "Needs you" tab lists.
 */
import { listOrders } from "@/lib/catering/orders";

export async function getCateringNeedsYouCount(): Promise<number> {
  const rows = await listOrders({ tab: "needs-you" });
  return rows.length;
}
