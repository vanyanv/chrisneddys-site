import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForAdmin, type AdminOrderDetail } from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import {
  formatCents,
  formatDateTime,
  orderStatusPill,
  statusLabel,
  stripePaymentUrl,
} from "../format";
import { AddressBlock, FulfilmentCard } from "./FulfilmentCard";
import { RefundCard } from "./RefundCard";
import "@/styles/admin-orders.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

function CustomerColumn({
  order,
  pickupAddress,
}: {
  order: AdminOrderDetail;
  pickupAddress: string | null;
}) {
  return (
    <section>
      <h3 className="adm-group-label">Customer</h3>
      <p className="ord-customer-line">{order.name ?? "—"}</p>
      <p className="ord-customer-line">
        {order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—"}
      </p>
      <p className="ord-customer-line">{order.phone ?? "—"}</p>

      <h3 className="adm-group-label ord-group-label-spaced">
        {order.fulfilment === "pickup" ? "Pickup" : "Ship to"}
      </h3>
      {order.fulfilment === "pickup" ? (
        <p className="adm-address ord-mono">{pickupAddress ?? "No pickup address on file."}</p>
      ) : (
        <AddressBlock shipTo={order.shipTo} />
      )}
    </section>
  );
}

function ItemsColumn({ order }: { order: AdminOrderDetail }) {
  return (
    <section>
      <h3 className="adm-group-label">Items</h3>
      <ul className="ord-item-list">
        {order.items.map((item) => (
          <li key={item.id} className="ord-item-row">
            <span className="ord-item-thumb" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="7" width="18" height="14" rx="1" />
                <path d="M8 7V5a4 4 0 0 1 8 0v2" />
              </svg>
            </span>
            <span className="ord-item-info">
              <span className="ord-item-name">
                {item.productName}
                {item.editionNumber && (
                  <span className="ord-item-edition"> #{item.editionNumber}</span>
                )}
              </span>
              <span className="ord-item-qty">
                {item.quantity} × {formatCents(item.unitPriceCents)}
              </span>
            </span>
            <span className="ord-item-total adm-money">
              {formatCents(item.unitPriceCents * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="adm-status-list ord-totals">
        <div>
          <dt>Subtotal</dt>
          <dd className="adm-money">{formatCents(order.subtotalCents)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd className="adm-money">{formatCents(order.shippingCents)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd className="adm-money">{formatCents(order.taxCents)}</dd>
        </div>
        <div className="ord-total-row">
          <dt>Total</dt>
          <dd className="adm-money">{formatCents(order.totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ActionsColumn({ order }: { order: AdminOrderDetail }) {
  return (
    <section>
      <h3 className="adm-group-label">Actions</h3>
      <FulfilmentCard order={order} />
      <RefundCard order={order} />
      {order.notes && (
        <div className="ord-notes">
          <p className="ord-action-heading">Notes</p>
          <p className="adm-notice">{order.notes}</p>
        </div>
      )}
    </section>
  );
}

type TimelineEvent = { label: string; date: Date };

/** No column tracks exactly when an order became ready-for-pickup, was
 * picked up, or was cancelled — only the current status does — so those
 * three steps fall back to `updatedAt` and only appear when that's the
 * order's status right now. Created/paid/fulfilled/refunded all have real
 * columns and always show once they've happened. */
function buildTimeline(order: AdminOrderDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [{ label: "Created", date: order.createdAt }];
  if (order.paidAt) events.push({ label: "Paid", date: order.paidAt });
  if (order.status === "ready_for_pickup") {
    events.push({ label: "Ready for pickup", date: order.updatedAt });
  }
  if (order.fulfilledAt) events.push({ label: "Fulfilled (shipped)", date: order.fulfilledAt });
  if (order.status === "picked_up") events.push({ label: "Picked up", date: order.updatedAt });
  if (order.refundedAt) events.push({ label: "Refunded", date: order.refundedAt });
  if (order.status === "cancelled") events.push({ label: "Cancelled", date: order.updatedAt });
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function TimelineSection({ order }: { order: AdminOrderDetail }) {
  const events = buildTimeline(order);
  return (
    <section className="ord-timeline-section">
      <h3 className="adm-group-label">Timeline</h3>
      <ol className="adm-timeline">
        {events.map((event) => (
          <li key={event.label}>
            <span className="adm-timeline-dot" aria-hidden="true" />
            <span className="adm-timeline-label">{event.label}</span>
            <span className="adm-timeline-time">{formatDateTime(event.date)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  const pickupAddress =
    order.fulfilment === "pickup" ? (await getStoreSettings()).pickupAddress : null;

  const pill = orderStatusPill(order.status, order.fulfilment);

  return (
    <>
      <Link href="/admin/orders" className="ord-back-link">
        ← Orders
      </Link>

      <div className="adm-order-head">
        <div>
          <h1 className="adm-h1">{order.number}</h1>
          <div className="adm-order-head-meta">
            <span className={`adm-pill ${pill.pillClass}`} title={statusLabel(order.status)}>
              {pill.label}
            </span>
            <span className="ord-head-placed">
              Placed {formatDateTime(order.createdAt)} ·{" "}
              {order.fulfilment === "ship" ? "Ship" : "Pickup"}
            </span>
          </div>
        </div>
        <div className="adm-order-head-actions">
          <Link href={`/admin/orders/${order.id}/packing-slip`} className="adm-btn">
            Packing slip
          </Link>
          {order.stripePaymentIntentId && (
            <a
              href={stripePaymentUrl(order.stripePaymentIntentId)}
              target="_blank"
              rel="noreferrer"
              className="ord-text-link"
            >
              Open in Stripe ↗
            </a>
          )}
        </div>
      </div>

      <div className="adm-row-expand-grid">
        <CustomerColumn order={order} pickupAddress={pickupAddress} />
        <ItemsColumn order={order} />
        <ActionsColumn order={order} />
      </div>

      <TimelineSection order={order} />
    </>
  );
}
