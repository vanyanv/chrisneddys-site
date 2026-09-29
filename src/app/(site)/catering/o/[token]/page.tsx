import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/catering-order.css";
import { getDb } from "@/db/client";
import { getOrderView } from "@/lib/catering/service";
import { isCateringStoreId } from "@/lib/catering/stores";
import { OrderLines } from "@/components/catering-order/OrderLines";
import { SummaryStrip } from "@/components/catering-order/SummaryStrip";
import { money } from "@/components/catering-order/money";
import type { CartLine } from "@/lib/catering/types";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Order-link pages: never cache — must reflect live order state.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Waiting on us",
  requested: "Waiting on us",
  booked: "Booked",
  declined: "We couldn't take this one",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};

function itemsAsLines(
  items: {
    itemId: string;
    qty: number;
    wayId: string | null;
    toppings: string[];
    extras: string[];
    forName: string | null;
    note: string | null;
  }[],
): CartLine[] {
  return items.map((it) => ({
    itemId: it.itemId,
    qty: it.qty,
    wayId: it.wayId as CartLine["wayId"],
    toppings: it.toppings,
    extras: it.extras,
    forName: it.forName ?? undefined,
    note: it.note ?? undefined,
  }));
}

/** O1: the customer's own order link — waiting on us / booked / declined,
 * plus links into O2 (change) and O3 (cancel) while those are allowed. */
export default async function CateringOrderLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const view = await getOrderView(db, token);

  if (!view.ok) {
    return (
      <div className="cor-order-link">
        <section className="cor-link-hero is-not-found">
          <h1>We couldn&rsquo;t find that order</h1>
          <p>
            The link may be mistyped or the order may have moved. Try{" "}
            <Link href="/catering/find/">finding your orders</Link> instead.
          </p>
        </section>
      </div>
    );
  }

  const { order, canCancel, canChange, cancellationQuote } = view;
  const lines = itemsAsLines(order.items);
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;

  return (
    <div className="cor-order-link">
      <section className={`cor-link-hero is-${order.status}`}>
        <p className="cor-link-tag">Catering order {order.number}</p>
        <span className={`cor-status-pill is-${order.status}`}>{statusLabel}</span>

        {order.status === "requested" && (
          <p>
            We&rsquo;ll confirm by{" "}
            {order.respondBy?.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }) ?? "soon"}
            . Your card is held, not charged.
          </p>
        )}
        {order.status === "booked" && (
          <p>
            Charged {money(order.totalCents)}
            {order.approvedAt
              ? ` on ${order.approvedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : ""}
            .{" "}
            {cancellationQuote.tier === "free"
              ? "Free to cancel"
              : cancellationQuote.tier === "half"
                ? "Half back if you cancel"
                : "No refund if you cancel"}{" "}
            now.
          </p>
        )}
        {order.status === "declined" && <p>{order.declineReason}</p>}
        {order.status === "cancelled" && <p>This order was cancelled.</p>}
        {order.status === "expired" && (
          <p>We didn&rsquo;t confirm in time, so the hold was released.</p>
        )}
        {order.status === "completed" && <p>Thanks for feeding the crew.</p>}
      </section>

      <SummaryStrip
        store={isCateringStoreId(order.store) ? order.store : null}
        fulfilment={order.fulfilment}
        date={null}
        time={null}
      />
      <p className="cor-fine">
        {new Date(order.eventAt).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
        {order.fulfilment === "delivery" && order.address ? ` · ${order.address.line1}` : ""}
      </p>

      <OrderLines lines={lines} />

      <p className="cor-review-total">
        <span>Total</span>
        <span>{money(order.totalCents)}</span>
      </p>

      <div className="cor-link-actions">
        <Link className="cor-btn is-secondary" href={`/catering/o/${token}/invoice/`}>
          View invoice
        </Link>
        {canChange && (
          <Link className="cor-btn is-secondary" href={`/catering/o/${token}/change/`}>
            Change order
          </Link>
        )}
        {canCancel && (
          <Link className="cor-btn is-secondary" href={`/catering/o/${token}/cancel/`}>
            Cancel order
          </Link>
        )}
      </div>
    </div>
  );
}
