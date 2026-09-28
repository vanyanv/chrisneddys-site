/** The Overview page's catering card (A1) — needs-you count, how many
 * booked orders fall this week, and the very next one. Built on `listOrders`
 * rather than a new query: "this week" and "next" are both just filters and
 * a sort over the "upcoming" tab's own rows. */
import { getDb } from "@/db/client";
import { listOrders } from "@/lib/catering/orders";
import { expireDue } from "@/lib/catering/service";
import { storeName } from "./format";

export type CateringOverviewSummary = {
  needsYouCount: number;
  thisWeekCount: number;
  next: { number: string; store: string; when: Date } | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getCateringOverviewSummary(): Promise<CateringOverviewSummary> {
  // The cron only runs daily now, so a `requested` order past its
  // `respondBy` can otherwise sit looking "needs you" for up to a day
  // after it's actually expired — this lazy check catches it the moment
  // anyone looks at the card.
  const db = await getDb();
  await expireDue(db, new Date());

  const [needsYou, upcoming] = await Promise.all([
    listOrders({ tab: "needs-you" }, db),
    listOrders({ tab: "upcoming" }, db),
  ]);

  const now = Date.now();
  const thisWeek = upcoming.filter((o) => o.eventAt.getTime() - now <= WEEK_MS);
  const sorted = [...upcoming].sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
  const nextOrder = sorted[0];

  return {
    needsYouCount: needsYou.length,
    thisWeekCount: thisWeek.length,
    next: nextOrder
      ? { number: nextOrder.number, store: storeName(nextOrder.store), when: nextOrder.eventAt }
      : null,
  };
}
