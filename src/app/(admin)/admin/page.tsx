import Image from "next/image";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/(admin)/admin/actions";
import { ownerInitials } from "@/app/(admin)/admin/ownerDisplay";
import { getStoreSettings } from "@/lib/orders";
import { isShopOpenFor } from "@/lib/shopStatus";
import {
  getHealthyConnections,
  getRecentActivity,
  getTodayStats,
  getWorkQueue,
  type RecentActivityEntry,
  type WorkQueueItem,
} from "@/lib/workQueue";
import "@/styles/admin-rack.css";

export const dynamic = "force-dynamic";

/** `/admin` — "Today", The Rack's work queue (issue #36, phase 1). This
 * page owns its whole shell (top bar, tabs, page header) rather than
 * rendering inside `admin/layout.tsx`'s Sheet chrome — see that file's
 * comment on why. Everything below reads from `src/lib/workQueue.ts`,
 * which is the only place this queue's real-data rules live (and the only
 * part of this feature that's unit-tested — this file is presentation
 * only). */

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
];

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** `short` gives the compact form ("14 MIN", "2 HR", "YDAY") the header
 * and activity feed use; the long form ("14 min ago") is for body copy. */
function relativeTime(date: Date, short: boolean): string {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return short ? "NOW" : "just now";
  if (minutes < 60) return short ? `${minutes} MIN` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return short ? `${hours} HR` : `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return short ? "YDAY" : "yesterday";
  return short ? `${days}D` : `${days} days ago`;
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v4M8 11h.01" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M2 5h12v9H2zM2 5l1.5-3h9L14 5M6 8h4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M2 2h5l7 7-5 5-7-7z" />
      <circle cx="5" cy="5" r="1" />
    </svg>
  );
}
function PickupIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M8 14s5-4.5 5-8a5 5 0 0 0-10 0c0 3.5 5 8 5 8z" />
      <circle cx="8" cy="6" r="1.6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg aria-hidden="true" className="rack-icon" viewBox="0 0 16 16">
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  );
}

type QueueRowContent = {
  icon: React.ReactNode;
  tone: "urgent" | "warn" | "default";
  title: string;
  meta: string;
  ctaLabel: string;
  ctaHref: string;
  ctaPrimary?: boolean;
};

function describeQueueItem(item: WorkQueueItem): QueueRowContent {
  switch (item.kind) {
    case "setup":
      return {
        icon: <AlertIcon />,
        tone: "urgent",
        title: item.title,
        meta: item.detail,
        ctaLabel: item.ctaLabel,
        ctaHref: item.ctaHref,
        ctaPrimary: true,
      };
    case "to-pack": {
      const numbers =
        item.orderNumbers.join(", ") + (item.moreCount > 0 ? ` +${item.moreCount}` : "");
      return {
        icon: <BoxIcon />,
        tone: "default",
        title: `${plural(item.count, "order")} to pack and ship`,
        meta: `${numbers} · ${formatMoney(item.totalCents)}`,
        ctaLabel: "Start packing",
        ctaHref: "/admin/orders?status=paid",
      };
    }
    case "stale-order":
      return {
        icon: <ClockIcon />,
        tone: "warn",
        title: `${item.orderNumber} has been waiting ${plural(item.daysWaiting, "day")}`,
        meta: `${item.customerName ?? "No name on file"} · paid ${plural(item.daysWaiting, "day")} ago · the oldest unshipped`,
        ctaLabel: "Pack it",
        ctaHref: `/admin/orders/${item.orderId}`,
      };
    case "to-prepare-pickup": {
      const numbers =
        item.orderNumbers.join(", ") + (item.moreCount > 0 ? ` +${item.moreCount}` : "");
      return {
        icon: <PickupIcon />,
        tone: "default",
        title: `${plural(item.count, "order")} to prepare for pickup`,
        meta: `${numbers} · ${formatMoney(item.totalCents)}`,
        ctaLabel: "Get them ready",
        ctaHref: "/admin/orders?status=paid",
      };
    }
    case "held-editions":
      return {
        icon: <TagIcon />,
        tone: "default",
        title: `${plural(item.count, "number")} held in open checkouts`,
        meta: "Not yet paid — releases back to the run once the hold expires",
        ctaLabel: "See the run",
        ctaHref: "/admin/products",
      };
  }
}

function QueueRow({ item, riseClass }: { item: WorkQueueItem; riseClass: string }) {
  const row = describeQueueItem(item);
  return (
    <div className={`rack-queue-item rack-rise ${riseClass}`}>
      <span className={`rack-queue-icon ${row.tone === "default" ? "" : `is-${row.tone}`}`}>
        {row.icon}
      </span>
      <div className="rack-queue-body">
        <div className="rack-queue-title">{row.title}</div>
        <div className="rack-queue-meta">{row.meta}</div>
      </div>
      <Link href={row.ctaHref} className={row.ctaPrimary ? "rack-btn-primary" : "rack-btn"}>
        {row.ctaLabel}
      </Link>
    </div>
  );
}

function ActivityRow({ entry }: { entry: RecentActivityEntry }) {
  return (
    <div className="rack-activity-row">
      <span className="rack-activity-when">{relativeTime(entry.when, true)}</span>
      <span className="rack-activity-what">
        {entry.orderNumber} paid · {formatMoney(entry.totalCents)}
      </span>
    </div>
  );
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(text: string): string {
  return text.length > 0 ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/**
 * The always-on health line under the queue (issue #50) — a persistent
 * footer rather than only a fallback for an empty queue, so a busy day
 * still gets confirmation the systems that ARE checked are fine. Built
 * from `getHealthyConnections`, which only ever lists a system that's
 * genuinely known to be ok right now (the same env-var reads
 * `getSetupChecklist` makes) — anything broken is already its own urgent
 * "setup" row in the queue above, so this line never repeats or contradicts
 * it, and never claims a system this app doesn't actually check. `null`
 * means there's nothing honest left to say (every checked system is
 * broken, which the queue itself is already shouting about).
 */
function healthFooterText(queueIsEmpty: boolean, healthyConnections: string[]): string | null {
  if (healthyConnections.length === 0) return queueIsEmpty ? "Nothing is waiting." : null;

  const verb = healthyConnections.length === 1 ? "is" : "are all";
  const sentence = `${capitalize(joinWithAnd(healthyConnections))} ${verb} fine.`;
  return queueIsEmpty ? `Nothing is waiting. ${sentence}` : sentence;
}

export default async function TodayPage() {
  const session = await requireOwner();
  const [settings, stats, queue, activity] = await Promise.all([
    getStoreSettings(),
    getTodayStats(),
    getWorkQueue(),
    getRecentActivity(5),
  ]);
  const healthFooter = healthFooterText(queue.length === 0, getHealthyConnections());

  const shopOpen = isShopOpenFor(settings);
  const initials = ownerInitials(session);
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const lastOrder = activity[0];
  const run = stats.run;

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
              aria-current={item.href === "/admin" ? "page" : undefined}
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

      <div className="rack-page-header">
        <div>
          <div className="rack-eyebrow">{dateLabel}</div>
          <h1 className="rack-page-title rack-bow">Today</h1>
        </div>
        <div className="rack-page-header-right">
          <span className="rack-page-count rack-mono">
            {lastOrder ? `LAST ORDER ${relativeTime(lastOrder.when, true)} AGO` : "NO ORDERS YET"}
          </span>
        </div>
      </div>

      <div className="rack-stats">
        <div className="rack-stat-card">
          <div className="rack-eyebrow">Money in today</div>
          <div className="rack-bow rack-mono rack-stat-value">
            {formatMoney(stats.moneyInTodayCents)}
          </div>
          <div className="rack-mono rack-stat-meta">
            {plural(stats.ordersToday, "order").toUpperCase()}
          </div>
        </div>
        <div className="rack-stat-card">
          <div className="rack-eyebrow">To pack</div>
          <div className="rack-bow rack-mono rack-stat-value">{stats.toPackCount}</div>
          <div className="rack-mono rack-stat-meta">
            {stats.toPackOldestDays !== null
              ? `OLDEST: ${plural(stats.toPackOldestDays, "day").toUpperCase()}`
              : "NONE WAITING"}
          </div>
        </div>
        {run && (
          <div className="rack-stat-card">
            <div className="rack-eyebrow">Left of the run</div>
            <div className="rack-bow rack-mono rack-stat-value">
              {run.available}
              <span style={{ fontSize: 17, color: "var(--rack-muted)" }}>/{run.editionSize}</span>
            </div>
            <div className="rack-mono rack-stat-meta">{run.productName.toUpperCase()}</div>
          </div>
        )}
      </div>

      <div className="rack-today-grid">
        <section className="rack-queue">
          <div className="rack-queue-head">
            <span className="rack-eyebrow">
              {queue.length > 0 ? `Needs you — ${plural(queue.length, "thing")}` : "Needs you"}
            </span>
            {queue.length > 0 && (
              <span className="rack-page-count rack-mono">IN THE ORDER I&apos;D DO THEM</span>
            )}
          </div>

          {queue.map((item, index) => (
            <QueueRow
              key={`${item.kind}-${index}`}
              item={item}
              riseClass={`r${Math.min(index + 1, 5)}`}
            />
          ))}

          {healthFooter && (
            <div className="rack-queue-clear">
              <CheckIcon />
              <span>{healthFooter}</span>
            </div>
          )}
        </section>

        <aside className="rack-side">
          {run && (
            <div className="rack-panel">
              <div className="rack-panel-head">
                <span className="rack-eyebrow">The run</span>
                <span className="rack-page-count rack-mono">{run.productName.toUpperCase()}</span>
              </div>
              <div className="rack-edgrid">
                {run.editions.map((edition) => (
                  <span
                    key={edition.number}
                    className={`rack-edcell ${
                      edition.status === "sold"
                        ? "is-sold"
                        : edition.status === "reserved"
                          ? "is-reserved"
                          : edition.status === "set_aside"
                            ? "is-aside"
                            : ""
                    }`}
                  />
                ))}
              </div>
              <div className="rack-edlegend">
                <span>
                  <i className="is-available"></i>
                  {run.available} going
                </span>
                <span>
                  <i className="is-reserved"></i>
                  {run.reserved} held
                </span>
                <span>
                  <i className="is-sold"></i>
                  {run.sold} sold
                </span>
                {run.setAside > 0 && (
                  <span>
                    <i className="is-aside"></i>
                    {run.setAside} set aside
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="rack-panel" style={{ flex: 1, minHeight: 0 }}>
            <span className="rack-eyebrow">Just happened</span>
            <div className="rack-activity" style={{ marginTop: 13 }}>
              {activity.length === 0 && <p>No orders yet.</p>}
              {activity.map((entry) => (
                <ActivityRow
                  key={`${entry.orderNumber}-${entry.when.toISOString()}`}
                  entry={entry}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
