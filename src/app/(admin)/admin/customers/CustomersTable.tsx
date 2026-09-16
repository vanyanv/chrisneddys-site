"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCents, formatMonthYear } from "./format";

/** Same shape as `AdminCustomerListRow` from `@/lib/customersAdmin`, but
 * with every `Date` pre-serialized to an ISO string by the server
 * component — the same reason `OrdersTable` does this for `createdAt`. */
export type CustomersTableRow = {
  key: string;
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  firstOrderAt: string | null;
  refundedCount: number;
};

function formatFirstOrder(iso: string | null): string {
  return iso ? formatMonthYear(new Date(iso)) : "—";
}

/** The customer list's search box + sheet rows — client-only so search can
 * filter the rows already fetched by the server component, same pattern as
 * `OrdersTable`. */
export function CustomersTable({ rows }: { rows: CustomersTableRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) => (row.name ?? "").toLowerCase().includes(q) || row.email.toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <>
      <label className="adm-search" style={{ margin: "4px 0 16px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className="adm-sr-only">Search customers</span>
        <input
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="adm-empty">No customers match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="cust-sheet">
          <div className="cust-cols" role="presentation">
            <span>Name</span>
            <span>Email</span>
            <span>Orders</span>
            <span>Spent</span>
            <span>First bought</span>
            <span>Sent back</span>
          </div>
          {filtered.map((row) => (
            <Link
              key={row.key}
              href={`/admin/customers/${encodeURIComponent(row.key)}`}
              className="cust-row"
            >
              <span className="cust-cell-name">{row.name ?? "—"}</span>
              <span className="cust-cell-email">{row.email}</span>
              <span className="cust-cell-num">{row.orderCount}</span>
              <span className="cust-cell-money">{formatCents(row.totalSpentCents)}</span>
              <span className="cust-cell-date">{formatFirstOrder(row.firstOrderAt)}</span>
              <span className="cust-cell-num">{row.refundedCount}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
