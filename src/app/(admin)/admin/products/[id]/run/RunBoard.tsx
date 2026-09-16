"use client";

import { useMemo, useState } from "react";
import type { RunForAdmin, RunNumberRow } from "@/lib/runAdmin";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "9:41" style countdown to `until` from right now — never negative (a hold
 * that's already lapsed by the time this renders will get swept up by
 * `releaseExpiredReservations` and simply stop showing up here on the next
 * load, so this only ever needs to describe time that's still ahead). */
function formatCountdown(until: Date): string {
  const ms = Math.max(0, until.getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function customerLabel(row: RunNumberRow): string {
  if (!row.order) return "—";
  return row.order.customerEmail ?? "Guest — not signed in";
}

function cellClass(status: RunNumberRow["status"]): string {
  if (status === "sold") return "run-cell is-sold";
  if (status === "reserved") return "run-cell is-reserved";
  return "run-cell is-available";
}

/**
 * "All fifty numbers" — the grid, the held-right-now list, and a detail
 * panel for whichever number is selected. Client-only for the click-to-
 * select interaction; every number it shows came straight from
 * `getRunForAdmin`'s server-side join, not anything computed here.
 */
export function RunBoard({ run }: { run: RunForAdmin }) {
  const held = useMemo(() => run.numbers.filter((n) => n.status === "reserved"), [run.numbers]);
  const firstInteresting = run.numbers.find((n) => n.status !== "available") ?? null;
  const [selectedNumber, setSelectedNumber] = useState<number | null>(
    firstInteresting?.number ?? null,
  );

  const selected = run.numbers.find((n) => n.number === selectedNumber) ?? null;

  return (
    <div className="rack-order-grid">
      <div className="rack-order-main">
        <section className="rack-order-card">
          <h3 className="rack-eyebrow rack-order-card-head">Every number, and where it went</h3>
          <p className="run-board-hint">Click one to see the order.</p>
          <div className="run-board-grid" role="group" aria-label="Every numbered edition">
            {run.numbers.map((row) => (
              <button
                key={row.number}
                type="button"
                className={`${cellClass(row.status)}${
                  row.number === selectedNumber ? " is-selected" : ""
                }`}
                data-testid={`run-cell-${row.number}`}
                aria-pressed={row.number === selectedNumber}
                title={`#${row.number} — ${row.status}`}
                onClick={() => setSelectedNumber(row.number)}
              >
                {row.number}
              </button>
            ))}
          </div>
          <div className="rack-edlegend" style={{ marginTop: 13 }}>
            <span>
              <i className="is-sold"></i>
              {run.counts.sold} sold
            </span>
            <span>
              <i className="is-reserved"></i>
              {run.counts.reserved} held in a checkout
            </span>
            <span>
              <i className="is-available"></i>
              {run.counts.available} still going
            </span>
          </div>
        </section>

        <section className="rack-order-card">
          <h3 className="rack-eyebrow rack-order-card-head">Held right now</h3>
          {held.length === 0 ? (
            <p className="run-board-empty">Nothing is mid-checkout right now.</p>
          ) : (
            <ul className="run-held-list">
              {held.map((row) => (
                <li key={row.number} className="run-held-row">
                  <span className="run-held-number rack-mono">#{row.number}</span>
                  <span className="run-held-customer">{customerLabel(row)}</span>
                  <span className="run-held-time rack-mono">
                    {row.reservedUntil ? formatCountdown(row.reservedUntil) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="run-board-hint" style={{ marginTop: 13 }}>
            Off the shelf while someone is at the checkout. They come back on their own — nobody is
            emailed about a lapsed hold.
          </p>
        </section>
      </div>

      <div className="rack-order-side">
        <div className="rack-panel">
          <h3 className="rack-eyebrow rack-order-card-head">
            {selected ? `Number ${selected.number}` : "Pick a number"}
          </h3>
          {!selected && <p className="run-board-empty">Click any cell in the grid to see it.</p>}
          {selected?.status === "available" && (
            <p className="run-board-empty">Still on the shelf — nobody has claimed it.</p>
          )}
          {selected?.status === "reserved" && (
            <>
              <p className="run-detail-line">Held right now.</p>
              <p className="run-detail-line">{customerLabel(selected)}</p>
              {selected.reservedUntil && (
                <p className="run-detail-line rack-mono">
                  {formatCountdown(selected.reservedUntil)} left on the hold
                </p>
              )}
            </>
          )}
          {selected?.status === "sold" && selected.order && (
            <>
              <p className="run-detail-line">{selected.order.customerName ?? "—"}</p>
              <p className="run-detail-line rack-mono">
                {selected.order.orderNumber} &middot; {selected.order.orderStatus.toUpperCase()}
                {selected.order.paidAt ? ` ${formatDateTime(selected.order.paidAt)}` : ""}
              </p>
              <a href={`/admin/orders/${selected.order.orderId}`} className="rack-btn">
                Open the order
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
