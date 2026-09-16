import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getOrderForAdmin, type AdminOrderDetail } from "@/lib/ordersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import {
  formatCents,
  formatDateTime,
  orderStatusPill,
  statusLabel,
  stripePaymentUrl,
} from "../format";
import { AddressBlock, FulfilmentCard } from "./FulfilmentCard";
import { RefundTrigger } from "./RefundPanel";
import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
];

function ItemsCard({ order }: { order: AdminOrderDetail }) {
  return (
    <section className="rack-order-card">
      <h3 className="rack-eyebrow rack-order-card-head">Items</h3>
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
    <section className="rack-order-card ord-timeline-card">
      <h3 className="rack-eyebrow rack-order-card-head">Timeline</h3>
      <ol className="adm-timeline">
        {events.map((event) => (
          <li key={event.label}>
            <span className="adm-timeline-dot" aria-hidden="true" />
            <span className="adm-timeline-label">{event.label}</span>
            <span className="adm-timeline-time">{formatDateTime(event.date)}</span>
          </li>
        ))}
      </ol>
      {order.notes && (
        <div className="ord-notes">
          <p className="ord-action-heading">Notes</p>
          <p className="adm-notice">{order.notes}</p>
        </div>
      )}
    </section>
  );
}

function CustomerCard({ order }: { order: AdminOrderDetail }) {
  return (
    <section className="rack-order-card">
      <h3 className="rack-eyebrow rack-order-card-head">Customer</h3>
      <p className="ord-customer-line">{order.name ?? "—"}</p>
      <p className="ord-customer-line">
        {order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : "—"}
      </p>
      <p className="ord-customer-line">{order.phone ?? "—"}</p>
    </section>
  );
}

function ShipToCard({
  order,
  pickupAddress,
}: {
  order: AdminOrderDetail;
  pickupAddress: string | null;
}) {
  return (
    <section className="rack-order-card">
      <h3 className="rack-eyebrow rack-order-card-head">
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

export default async function AdminOrderDetailPage({ params }: { params: Promise<Params> }) {
  const session = await requireOwner();
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderForAdmin(id), getStoreSettings()]);
  if (!order) notFound();

  const pickupAddress = order.fulfilment === "pickup" ? settings.pickupAddress : null;
  const pill = orderStatusPill(order.status, order.fulfilment);
  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);

  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <Link href="/admin" className="rack-brand">
          <Image
            src="/cne-logo.webp"
            alt="Chris N Eddy's"
            width={309}
            height={89}
            className="rack-logo"
            priority
          />
          <span className="rack-wordmark-tag rack-mono">STORE</span>
        </Link>
        <div className="rack-tabs">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rack-tab"
              aria-current={item.href === "/admin/orders" ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="rack-top-right">
          <span className={`rack-store-pill rack-mono ${shopOpen ? "" : "is-closed"}`}>
            <i></i>Store: {shopOpen ? "Open" : "Closed"}
          </span>
          <details className="rack-avatar-menu">
            <summary className="rack-avatar">{initials}</summary>
            <div className="rack-menu">
              <p className="rack-menu-email">{session.email}</p>
              <form action={signOutAction}>
                <button type="submit" className="rack-menu-signout">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </nav>

      <div style={{ padding: "18px 22px 0" }}>
        <Link href="/admin/orders" className="ord-back-link">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          All orders
        </Link>
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <h1 className="rack-page-title rack-bow" style={{ fontSize: 40 }}>
            {order.number}
          </h1>
          <span className="adm-order-head-meta">
            <span className={`adm-pill ${pill.pillClass}`} title={statusLabel(order.status)}>
              {pill.label}
            </span>
          </span>
          <span className="ord-fulfil-tag">{order.fulfilment === "ship" ? "Ship" : "Pickup"}</span>
        </div>
        <div className="rack-page-header-right">
          <Link href={`/admin/orders/${order.id}/packing-slip`} className="rack-btn">
            Packing slip
          </Link>
          <RefundTrigger order={order} />
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

      <div className="rack-order-grid">
        <div className="rack-order-main">
          <ItemsCard order={order} />
          <TimelineCard order={order} />
        </div>

        <div className="rack-order-side">
          <div className="rack-panel rack-order-next">
            <h3 className="rack-eyebrow rack-order-card-head">Next</h3>
            <FulfilmentCard order={order} />
          </div>
          <CustomerCard order={order} />
          <ShipToCard order={order} pickupAddress={pickupAddress} />
        </div>
      </div>
    </div>
  );
}
