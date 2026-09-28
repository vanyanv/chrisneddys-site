/** The order detail page's timeline — `catering_events` has no reader in
 * `src/lib/catering/orders.ts` yet (only `recordEvent`, which appends), so
 * this reads the table directly the same way `../orders/[id]/page.tsx`'s
 * own `getOrderEdition` reads `orderItems` directly: a small, page-local
 * query rather than a change to a data-layer module this phase doesn't own. */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cateringEvents } from "@/db/schema";
import type { CateringEvent } from "@/lib/catering/orders";

export async function listCateringEvents(orderId: string): Promise<CateringEvent[]> {
  const db = await getDb();
  return db
    .select()
    .from(cateringEvents)
    .where(eq(cateringEvents.orderId, orderId))
    .orderBy(asc(cateringEvents.at));
}
