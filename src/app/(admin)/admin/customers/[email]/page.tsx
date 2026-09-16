import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import {
  getCustomerForAdmin,
  type AdminCustomerDetail,
  type AdminCustomerOwnedNumber,
} from "@/lib/customersAdmin";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import type { RunForAdmin } from "@/lib/runAdmin";
import {
  formatCents,
  formatDateTime,
  formatMonthYear,
  orderStatusPill,
  statusLabel,
} from "../format";
import "@/styles/admin-rack.css";
import "@/styles/admin-customers.css";
import "@/styles/admin-orders.css";

export const dynamic = "force-dynamic";

type Params = { email: string };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

function initialsFor(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function OrdersCard({ customer }: { customer: AdminCustomerDetail }) {
  return (
    <section className="rack-order-card">
      <h3 className="rack-eyebrow rack-order-card-head">Orders</h3>
      <div className="cust-orders-list">
        {customer.orders.map((order) => {
          const pill = orderStatusPill(order.status, order.fulfilment);
          return (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className="cust-order-row">
              <span className="cust-order-num">{order.number}</span>
              <span className="cust-order-date">{formatDateTime(order.createdAt)}</span>
              <span className="cust-order-items">{order.itemsSummary}</span>
              <span className="cust-order-total">{formatCents(order.totalCents)}</span>
              <span
                className={`cust-order-status adm-pill ${pill.pillClass}`}
                title={statusLabel(order.status)}
              >
                {pill.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NumbersCard({
  ownedNumbers,
  runs,
}: {
  ownedNumbers: AdminCustomerOwnedNumber[];
  runs: RunForAdmin[];
}) {
  if (ownedNumbers.length === 0) return null;

  return (
    <div className="rack-panel">
      <h3 className="rack-eyebrow rack-order-card-head">Numbers they own</h3>
      <div className="cust-number-chips">
        {ownedNumbers.map((n) => (
          <span key={`${n.productId}-${n.number}`} className="cust-number-chip">
            #{n.number}
          </span>
        ))}
      </div>

      {runs.map((run) => (
        <div key={run.productId} className="rack-hairline">
          <div className="rack-eyebrow" style={{ marginBottom: 11 }}>
            Where they sit in {run.productTitle || "the run"}
          </div>
          <div className="rack-edgrid">
            {run.numbers.map((row) => (
              <span
                key={row.number}
                className={`rack-edcell ${
                  row.status === "sold" ? "is-sold" : row.status === "reserved" ? "is-reserved" : ""
                }`}
                title={`#${row.number} — ${row.status}`}
              />
            ))}
          </div>
          <div className="rack-edlegend" style={{ marginTop: 8 }}>
            <span>
              <i className="is-available"></i>
              {run.counts.available} left
            </span>
            <span>
              <i className="is-reserved"></i>
              {run.counts.reserved} held
            </span>
            <span>
              <i className="is-sold"></i>
              {run.counts.sold} sold
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<Params> }) {
  const session = await requireOwner();
  const { email } = await params;
  const [customer, settings] = await Promise.all([
    getCustomerForAdmin(decodeURIComponent(email)),
    getStoreSettings(),
  ]);
  if (!customer) notFound();

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);
  const custInitials = initialsFor(customer.name, customer.email);

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
              aria-current={item.href === "/admin/customers" ? "page" : undefined}
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
        <Link href="/admin/customers" className="ord-back-link">
          <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Everyone who&rsquo;s bought
        </Link>
      </div>

      <div className="rack-page-header" style={{ paddingTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span className="rack-avatar" style={{ width: 52, height: 52, fontSize: 17 }}>
            {custInitials}
          </span>
          <div>
            <h1 className="rack-page-title rack-bow" style={{ fontSize: 32 }}>
              {customer.name ?? "Unnamed customer"}
            </h1>
            <div className="rack-mono cust-header-meta">
              {customer.email}
              {customer.phone ? ` · ${customer.phone}` : ""}
            </div>
          </div>
        </div>
        <div className="rack-page-header-right">
          <a href={`mailto:${customer.email}`} className="rack-btn">
            Email {customer.name?.split(" ")[0] ?? "customer"}
          </a>
        </div>
      </div>

      <div className="rack-stats">
        <div className="rack-stat-card">
          <div className="rack-eyebrow">Orders</div>
          <div className="rack-bow rack-mono rack-stat-value">{customer.orderCount}</div>
        </div>
        <div className="rack-stat-card">
          <div className="rack-eyebrow">Spent</div>
          <div className="rack-bow rack-mono rack-stat-value">
            {formatCents(customer.totalSpentCents)}
          </div>
        </div>
        <div className="rack-stat-card">
          <div className="rack-eyebrow">First bought</div>
          <div className="rack-bow rack-mono rack-stat-value">
            {customer.firstOrderAt ? formatMonthYear(customer.firstOrderAt).toUpperCase() : "—"}
          </div>
        </div>
        <div className="rack-stat-card">
          <div className="rack-eyebrow">Sent back</div>
          <div className="rack-bow rack-mono rack-stat-value">{customer.refundedCount}</div>
        </div>
      </div>

      {customer.ownedNumbers.length > 0 ? (
        <div className="rack-order-grid">
          <div className="rack-order-main">
            <OrdersCard customer={customer} />
          </div>
          <div className="rack-order-side">
            <NumbersCard ownedNumbers={customer.ownedNumbers} runs={customer.runs} />
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 22px 22px" }}>
          <OrdersCard customer={customer} />
        </div>
      )}
    </div>
  );
}
