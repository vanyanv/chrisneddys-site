import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import {
  getOrderById,
  type CateringOrderItem,
  type CateringOrderWithItems,
} from "@/lib/catering/orders";
import { getPublicCateringConfig } from "@/lib/catering/public";
import { getDb } from "@/db/client";
import { expireDue } from "@/lib/catering/service";
import { CateringNavBadge } from "../CateringNavBadge";
import { getCateringNeedsYouCount } from "../navCount";
import {
  cateringStatusPill,
  customerHeadline,
  formatCents,
  formatDateTime,
  fulfilmentLabel,
  statusLabel,
  storeName,
  stripePaymentUrl,
} from "../format";
import { listCateringEvents } from "./events";
import { OrderActionsPanel } from "./OrderActionsPanel";
import { ChangeReviewPanel } from "./ChangeReviewPanel";
import { NoteForm } from "./NoteForm";
import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";
import "@/styles/admin-catering.css";

export const dynamic = "force-dynamic";

type Params = { id: string };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/catering", label: "Catering" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

const EVENT_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved · charged",
  declined: "Declined",
  expired: "Expired — no reply in time",
  cancelled: "Cancelled",
  change_requested: "Change requested",
  change_approved: "Change approved",
  change_declined: "Change declined",
  note: "Note added",
  email_sent: "Email sent",
  refunded: "Refunded",
  charged: "Charged",
  completed: "Marked completed",
};

function eventLabel(kind: string): string {
  return EVENT_LABELS[kind] ?? kind;
}

function ItemRow({ item }: { item: CateringOrderItem }) {
  return (
    <li className="cat-item-row">
      <div className="cat-item-body">
        <div className="cat-item-name-row">
          <span className="cat-item-name">{item.itemName}</span>
          <span className="cat-item-amount adm-money">{formatCents(item.amountCents)}</span>
        </div>
        <div className="cat-item-tags">
          {item.forName && <span className="cat-tag">For {item.forName}</span>}
          {item.extraLabels.map((label) => (
            <span key={label} className={`cat-tag is-halal`}>
              {label}
            </span>
          ))}
        </div>
        {(item.wayLabel || item.toppingLabels.length > 0) && (
          <div className="cat-item-meta">
            {item.wayLabel ? (
              <strong style={{ color: "var(--rack-ink)" }}>{item.wayLabel}</strong>
            ) : (
              "Custom"
            )}
            {item.toppingLabels.length > 0 && <> · {item.toppingLabels.join(", ")}</>}
          </div>
        )}
        {item.note && <div className="cat-item-note">&ldquo;{item.note}&rdquo;</div>}
        <div className="cat-item-qty">
          {item.qty} × {formatCents(item.unitCents)}
        </div>
      </div>
    </li>
  );
}

function ItemsCard({ order }: { order: CateringOrderWithItems }) {
  return (
    <section className="rack-order-card">
      <h3 className="rack-eyebrow rack-order-card-head">Items</h3>
      <ul className="ord-item-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {order.items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
      <dl className="adm-status-list ord-totals">
        <div>
          <dt>Food</dt>
          <dd className="adm-money">{formatCents(order.foodCents)}</dd>
        </div>
        {order.fulfilment === "delivery" && (
          <div>
            <dt>Delivery</dt>
            <dd className="adm-money">{formatCents(order.deliveryCents)}</dd>
          </div>
        )}
        <div>
          <dt>Tax</dt>
          <dd className="adm-money">{formatCents(order.taxCents)}</dd>
        </div>
        <div>
          <dt>Tip</dt>
          <dd className="adm-money">{formatCents(order.tipCents)}</dd>
        </div>
        <div className="ord-total-row">
          <dt>Total</dt>
          <dd className="adm-money">{formatCents(order.totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default async function AdminCateringOrderDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const session = await requireOwner();
  const { id } = await params;

  // The cron that expires overdue requests only runs daily now, so this
  // lazy check runs on every load of the order page too — otherwise a
  // `requested` order past its `respondBy` can sit un-expired for up to a
  // day even while its own page is open.
  const db = await getDb();
  await expireDue(db, new Date());

  const [order, settings, cateringCount, events, publicConfig] = await Promise.all([
    getOrderById(id, db),
    getStoreSettings(),
    getCateringNeedsYouCount(),
    listCateringEvents(id),
    getPublicCateringConfig(db),
  ]);
  if (!order) notFound();

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);
  const pill = cateringStatusPill(order.status, order.pendingChange !== null);
  const pickupStore = publicConfig.stores.find((s) => s.id === order.store);

  return (
    <div className="rack-root">
      <nav className="rack-topbar" aria-label="Admin sections">
        <Link href="/admin" className="rack-brand">
          <Image
            src="/cne-logo-2x.webp"
            alt="Chris N Eddy's"
            width={309}
            height={87}
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
              aria-current={item.href === "/admin/catering" ? "page" : undefined}
            >
              {item.label}
              {item.href === "/admin/catering" && <CateringNavBadge count={cateringCount} />}
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
        <Link href="/admin/catering" className="ord-back-link">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          All catering
        </Link>
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
            <h1 className="rack-page-title rack-bow" style={{ fontSize: 36 }}>
              {order.number}
            </h1>
            <span className={`adm-pill ${pill.pillClass}`} title={statusLabel(order.status)}>
              {pill.label}
            </span>
          </div>
          <p
            className="rack-mono"
            style={{ fontSize: 11.5, color: "var(--rack-muted)", marginTop: 4 }}
          >
            {storeName(order.store).toUpperCase()} &middot;{" "}
            {fulfilmentLabel(order.fulfilment).toUpperCase()} &middot;{" "}
            {formatDateTime(order.eventAt).toUpperCase()} &middot; {order.headcount} PEOPLE
          </p>
        </div>
        <div className="rack-page-header-right cat-print-links">
          <Link
            href={`/admin/catering/${order.id}/crew-ticket`}
            className="rack-btn"
            target="_blank"
          >
            Crew ticket
          </Link>
          <Link href={`/admin/catering/${order.id}/labels`} className="rack-btn" target="_blank">
            Labels
          </Link>
          <Link href={`/admin/catering/${order.id}/invoice`} className="rack-btn" target="_blank">
            Invoice
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

      <div className="rack-order-grid">
        <div className="rack-order-main">
          <ItemsCard order={order} />

          <section className="rack-order-card ord-timeline-card">
            <h3 className="rack-eyebrow rack-order-card-head">Timeline</h3>
            <ol className="adm-timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <span className="adm-timeline-dot" aria-hidden="true" />
                  <span className="adm-timeline-label">{eventLabel(event.kind)}</span>
                  <span className="adm-timeline-time">{formatDateTime(event.at)}</span>
                </li>
              ))}
              {events.length === 0 && (
                <li>
                  <span className="adm-timeline-dot" aria-hidden="true" />
                  <span className="adm-timeline-label">Created</span>
                  <span className="adm-timeline-time">{formatDateTime(order.createdAt)}</span>
                </li>
              )}
            </ol>
            <NoteForm orderId={order.id} existingNote={order.ownerNote} />
          </section>
        </div>

        <div className="rack-order-side">
          {order.pendingChange && (
            <ChangeReviewPanel
              orderId={order.id}
              pendingChange={order.pendingChange}
              currentTotalCents={order.totalCents}
            />
          )}

          <OrderActionsPanel
            orderId={order.id}
            status={order.status}
            hasPendingChange={order.pendingChange !== null}
            totalCents={order.totalCents}
            respondBy={order.respondBy}
          />

          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">Customer</h3>
            <p className="ord-customer-line">{customerHeadline(order)}</p>
            {order.company && <p className="ord-customer-line">{order.contactName}</p>}
            <p className="ord-customer-line">
              <a href={`mailto:${order.contactEmail}`}>{order.contactEmail}</a>
            </p>
            <p className="ord-customer-line">
              {order.contactPhone}
              {order.poNumber && <> &middot; PO {order.poNumber}</>}
            </p>
          </section>

          <section className="rack-order-card">
            <h3 className="rack-eyebrow rack-order-card-head">
              {order.fulfilment === "delivery" ? "Deliver to" : "Pickup"}
            </h3>
            {order.fulfilment === "delivery" && order.address ? (
              <>
                <p className="adm-address ord-mono">
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ""}
                  <br />
                  {order.address.city}, {order.address.state} {order.address.zip}
                  {order.distanceMiles !== null && !order.rangeUnknown && (
                    <> &middot; {order.distanceMiles} mi</>
                  )}
                </p>
                {order.rangeUnknown && (
                  <span className="cat-range-flag">Distance unknown — ZIP not recognized</span>
                )}
                {(order.onsiteContactName || order.onsiteContactPhone) && (
                  <div className="rack-hairline" style={{ marginTop: 10 }}>
                    <p className="rack-eyebrow" style={{ marginBottom: 4 }}>
                      On site
                    </p>
                    <p className="ord-customer-line">
                      {order.onsiteContactName}
                      {order.onsiteContactPhone && <> &middot; {order.onsiteContactPhone}</>}
                    </p>
                  </div>
                )}
                {order.address.instructions && (
                  <p className="adm-notice" style={{ marginTop: 8 }}>
                    &ldquo;{order.address.instructions}&rdquo;
                  </p>
                )}
              </>
            ) : (
              <p className="adm-address ord-mono">
                {pickupStore
                  ? `${pickupStore.name} — ${pickupStore.address}, ${pickupStore.city}`
                  : storeName(order.store)}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
