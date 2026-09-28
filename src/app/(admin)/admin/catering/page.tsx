import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import { getDb } from "@/db/client";
import { listOrders, type CateringOrdersTab } from "@/lib/catering/orders";
import { expireDue } from "@/lib/catering/service";
import { CateringNavBadge } from "./CateringNavBadge";
import { CateringListTable, type CateringListRow } from "./CateringListTable";
import "@/styles/admin-rack.css";
import "@/styles/admin-orders.css";
import "@/styles/admin-catering.css";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/catering", label: "Catering" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

const TABS: { key: CateringOrdersTab; label: string }[] = [
  { key: "needs-you", label: "Needs you" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
];

function tabHref(key: CateringOrdersTab): string {
  return `/admin/catering?tab=${key}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AdminCateringListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireOwner();
  const { tab: rawTab } = await searchParams;
  const tab: CateringOrdersTab = TABS.some((t) => t.key === rawTab)
    ? (rawTab as CateringOrdersTab)
    : "needs-you";

  // The cron that expires overdue requests only runs daily now, so this
  // lazy check runs on every load of the list — otherwise an order past
  // its `respondBy` can sit showing as "needs you" for up to a day.
  const db = await getDb();
  await expireDue(db, new Date());

  const [settings, rows, needsYou, upcoming, past] = await Promise.all([
    getStoreSettings(),
    listOrders({ tab }, db),
    listOrders({ tab: "needs-you" }, db),
    listOrders({ tab: "upcoming" }, db),
    listOrders({ tab: "past" }, db),
  ]);

  const now = Date.now();
  const thisWeekCount = upcoming.filter((o) => o.eventAt.getTime() - now <= WEEK_MS).length;
  const totalCount = needsYou.length + upcoming.length + past.length;
  const cateringCount = needsYou.length;

  const tableRows: CateringListRow[] = rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    fulfilment: o.fulfilment,
    store: o.store,
    eventAt: o.eventAt.toISOString(),
    respondBy: o.respondBy ? o.respondBy.toISOString() : null,
    headcount: o.headcount,
    contactName: o.contactName,
    contactEmail: o.contactEmail,
    company: o.company,
    totalCents: o.totalCents,
    hasPendingChange: o.pendingChange !== null,
  }));

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);

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

      <div className="rack-page-header">
        <div>
          <h1 className="rack-page-title rack-bow">Catering</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-page-count rack-mono">
            {totalCount} order{totalCount === 1 ? "" : "s"} &middot; {needsYou.length} need you
            &middot; {thisWeekCount} this week
          </span>
          <Link href="/admin/catering/emails" className="rack-btn">
            Email previews
          </Link>
        </div>
      </div>

      <div style={{ padding: "0 22px 22px" }}>
        <nav className="cat-tabs" aria-label="Filter by status">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`adm-filter-chip${tab === t.key ? " is-on" : ""}`}
              aria-current={tab === t.key ? "page" : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <div className="cat-list-empty">
            <div className="cat-list-empty-icon" aria-hidden="true">
              🍔
            </div>
            <p style={{ fontWeight: 700 }}>
              {tab === "needs-you"
                ? "Nothing needs you."
                : tab === "upcoming"
                  ? "Nothing booked yet."
                  : "No catering yet."}
            </p>
            <p className="rack-mono" style={{ fontSize: 11 }}>
              Requests land here and in {settings.supportEmail || "your inbox"}.
            </p>
          </div>
        ) : (
          <CateringListTable rows={tableRows} />
        )}
      </div>
    </div>
  );
}
