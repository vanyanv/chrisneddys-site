import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForAdmin, type AdminOrderDetail } from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import {
  formatCents,
  formatDateTime,
  relativeTime,
  statusLabel,
  stripePaymentUrl,
} from "../format";
import { FulfilmentCard } from "./FulfilmentCard";
import { RefundCard } from "./RefundCard";

export const dynamic = "force-dynamic";

type Params = { id: string };

function CustomerCard({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Customer</h2>
      <dl className="adm-status-list">
        <div>
          <dt>Name</dt>
          <dd>{order.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{order.phone ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function ItemsCard({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Items</h2>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Edition</th>
              <th>Qty</th>
              <th>Unit price</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td className="adm-money">{item.editionNumber ? `#${item.editionNumber}` : "—"}</td>
                <td>{item.quantity}</td>
                <td className="adm-money">{formatCents(item.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalsCard({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Totals</h2>
      <dl className="adm-status-list">
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
        <div>
          <dt>Total</dt>
          <dd className="adm-money">{formatCents(order.totalCents)}</dd>
        </div>
      </dl>
    </div>
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

function TimelineCard({ order }: { order: AdminOrderDetail }) {
  const events = buildTimeline(order);
  return (
    <div className="adm-card">
      <h2 className="adm-h2">Timeline</h2>
      <ol className="adm-timeline">
        {events.map((event) => (
          <li key={event.label}>
            <span className="adm-timeline-dot" aria-hidden="true" />
            <span className="adm-timeline-label">{event.label}</span>
            <span className="adm-timeline-time">{formatDateTime(event.date)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  const pickupAddress =
    order.fulfilment === "pickup" ? (await getStoreSettings()).pickupAddress : null;

  return (
    <>
      <div className="adm-order-head">
        <div>
          <h1 className="adm-h1">{order.number}</h1>
          <div className="adm-order-head-meta">
            <span className="adm-chip" data-order-status={order.status}>
              {statusLabel(order.status)}
            </span>
            <span>Placed {relativeTime(order.createdAt)}</span>
          </div>
        </div>
        <div className="adm-order-head-actions">
          {order.stripePaymentIntentId && (
            <a
              href={stripePaymentUrl(order.stripePaymentIntentId)}
              target="_blank"
              rel="noreferrer"
              className="adm-btn"
            >
              Open in Stripe →
            </a>
          )}
          <Link href={`/admin/orders/${order.id}/packing-slip`} className="adm-btn adm-btn-primary">
            Packing slip
          </Link>
        </div>
      </div>

      <div className="adm-editor-grid">
        <div className="adm-editor-left">
          <CustomerCard order={order} />
          <FulfilmentCard order={order} pickupAddress={pickupAddress} />
          <ItemsCard order={order} />
        </div>
        <div className="adm-editor-right">
          <TotalsCard order={order} />
          <RefundCard order={order} />
          {order.notes && (
            <div className="adm-card">
              <h2 className="adm-h2">Notes</h2>
              <p className="adm-notice">{order.notes}</p>
            </div>
          )}
          <TimelineCard order={order} />
        </div>
      </div>
    </>
  );
}
