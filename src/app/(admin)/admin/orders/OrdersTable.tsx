"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatCents,
  formatDateTime,
  itemsShortSummary,
  orderStatusPill,
  relativeTime,
  statusLabel,
} from "./format";

/** Same shape as `AdminOrderListRow` from `@/lib/ordersAdmin`, but with
 * `createdAt` pre-serialized to an ISO string by the server component —
 * avoids relying on Date objects surviving the server/client boundary. */
export type OrdersTableRow = {
  id: string;
  number: string;
  status: string;
  fulfilment: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  itemsSummary: string;
  totalCents: number;
};

/** The list's search box + sheet rows. Client-only so search can filter the
 * rows already fetched by the server component with no new query — the
 * six status tabs and pagination stay server-rendered links in page.tsx. */
export function OrdersTable({ rows }: { rows: OrdersTableRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.number.toLowerCase().includes(q) ||
        (row.customerName ?? "").toLowerCase().includes(q) ||
        (row.customerEmail ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <>
      <label className="adm-search ord-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="adm-sr-only">Search orders</span>
        <input
          placeholder="Search order #, name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="adm-empty">No orders match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="ord-sheet">
          <div className="ord-cols" role="presentation">
            <span>Order</span>
            <span>Placed</span>
            <span>Customer</span>
            <span>Items</span>
            <span>Method</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          {filtered.map((row) => {
            const pill = orderStatusPill(row.status, row.fulfilment);
            const { first, moreCount } = itemsShortSummary(row.itemsSummary);
            const createdAt = new Date(row.createdAt);
            return (
              <Link key={row.id} href={`/admin/orders/${row.id}`} className="ord-row">
                <span className="ord-cell-num">{row.number}</span>
                <time
                  className="ord-cell-placed"
                  dateTime={row.createdAt}
                  title={formatDateTime(createdAt)}
                >
                  {relativeTime(createdAt)}
                </time>
                <span className="ord-cell-customer">
                  <span className="ord-customer-name">{row.customerName ?? "—"}</span>
                  <span className="ord-customer-email">{row.customerEmail ?? "—"}</span>
                </span>
                <span className="ord-cell-items">
                  <span className="ord-items-first">{first}</span>
                  {moreCount > 0 && <span className="ord-items-more">+{moreCount} more</span>}
                </span>
                <span className="ord-fulfil-tag">
                  {row.fulfilment === "ship" ? "Ship" : "Pickup"}
                </span>
                <span className="ord-cell-total adm-money">{formatCents(row.totalCents)}</span>
                <span
                  className={`adm-pill ${pill.pillClass} ord-cell-status`}
                  title={statusLabel(row.status)}
                >
                  {pill.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
