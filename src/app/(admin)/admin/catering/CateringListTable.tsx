"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CateringOrderStatus } from "@/lib/catering/orders";
import {
  cateringStatusPill,
  customerHeadline,
  formatCents,
  formatCountdown,
  formatDateTime,
  fulfilmentLabel,
  storeName,
} from "./format";

export type CateringListRow = {
  id: string;
  number: string;
  status: CateringOrderStatus;
  fulfilment: string;
  store: string;
  eventAt: string;
  respondBy: string | null;
  contactName: string;
  contactEmail: string;
  company: string | null;
  totalCents: number;
  hasPendingChange: boolean;
};

/** The catering list's search box + sheet rows — same client-side filter
 * over already-fetched rows as `../orders/OrdersTable.tsx`; the three tabs
 * stay server-rendered links in `page.tsx`. */
export function CateringListTable({ rows }: { rows: CateringListRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.number.toLowerCase().includes(q) ||
        row.contactName.toLowerCase().includes(q) ||
        row.contactEmail.toLowerCase().includes(q) ||
        (row.company ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <>
      <label className="adm-search ord-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="adm-sr-only">Search catering orders</span>
        <input
          placeholder="Search order #, name or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="adm-empty">No catering orders match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="ord-sheet">
          <div className="cat-row cat-row-head" aria-hidden="true">
            <span className="cat-row-num">Order</span>
            <span className="cat-row-when">For</span>
            <span className="cat-row-customer">Customer</span>
            <span className="cat-row-store">Location</span>
            <span className="cat-row-total">Total</span>
            <span className="cat-row-status">Status</span>
          </div>
          {filtered.map((row) => {
            const pill = cateringStatusPill(row.status, row.hasPendingChange);
            const respondBy = row.respondBy ? new Date(row.respondBy) : null;
            const needsCountdown =
              (row.status === "requested" || row.hasPendingChange) && respondBy !== null;
            return (
              // `prefetch={false}`: every visible row's Link auto-prefetches
              // as it filters into view, and clicking a row right after
              // typing in the search box (which remounts every filtered
              // Link at once) could race that batch of prefetch fetches
              // against the click's own navigation fetch — intermittently
              // the navigation's RSC response would come back but the
              // router never applied it, leaving the list showing with no
              // error. Skipping prefetch for this short, already-fetched
              // list costs nothing (the row's own data is already on the
              // page) and removes the race.
              <Link
                key={row.id}
                href={`/admin/catering/${row.id}`}
                className="cat-row"
                prefetch={false}
              >
                <span className="cat-row-num rack-mono" style={{ fontWeight: 700, fontSize: 13 }}>
                  {row.number}
                </span>
                <span className="cat-row-when rack-mono">
                  {formatDateTime(new Date(row.eventAt))}
                </span>
                <span className="cat-row-customer">
                  <span className="cat-row-customer-name">{customerHeadline(row)}</span>
                  <span className="cat-row-customer-email">{row.contactEmail}</span>
                </span>
                <span className="cat-row-store">
                  {storeName(row.store)} &middot; {fulfilmentLabel(row.fulfilment)}
                </span>
                <span className="cat-row-total adm-money">{formatCents(row.totalCents)}</span>
                <span className="cat-row-status">
                  <span className={`adm-pill ${pill.pillClass}`}>{pill.label}</span>
                  {needsCountdown && respondBy && (
                    <span className="cat-respond-note">{formatCountdown(respondBy)}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
