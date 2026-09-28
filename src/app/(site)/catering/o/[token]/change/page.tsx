import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/catering-order.css";
import { getDb } from "@/db/client";
import { getOrderView } from "@/lib/catering/service";
import { getPublicCateringConfig } from "@/lib/catering/public";
import { isCateringStoreId } from "@/lib/catering/stores";
import type { CartLine } from "@/lib/catering/types";
import { ChangeBuilder } from "./ChangeBuilder";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** O2: reopens the builder seeded with the order so the customer can change
 * headcount, lines or time, then sends the change for the owner to approve. */
export default async function CateringChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const [view, config] = await Promise.all([getOrderView(db, token), getPublicCateringConfig(db)]);
  if (!view.ok || !view.canChange) notFound();

  const store = isCateringStoreId(view.order.store) ? view.order.store : config.stores[0]?.id;
  if (!store) notFound();

  const lines: CartLine[] = view.order.items.map((it) => ({
    itemId: it.itemId,
    qty: it.qty,
    wayId: it.wayId as CartLine["wayId"],
    toppings: it.toppings,
    extras: it.extras,
    forName: it.forName ?? undefined,
    note: it.note ?? undefined,
  }));

  return (
    <div className="cor-order-link">
      <ChangeBuilder
        token={token}
        number={view.order.number}
        store={store}
        fulfilment={view.order.fulfilment}
        headcount={view.order.headcount}
        eventAtIso={view.order.eventAt.toISOString()}
        totalCents={view.order.totalCents}
        lines={lines}
        config={config}
      />
    </div>
  );
}
