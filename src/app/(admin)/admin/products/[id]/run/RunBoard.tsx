"use client";

import { useEffect, useMemo, useState } from "react";
import type { RunForAdmin, RunNumberRow } from "@/lib/runAdmin";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "9:41" style countdown to `until` from `now` — never negative (a hold
 * that's already lapsed will get swept up by `releaseExpiredReservations`
 * and simply stop showing up here on the next load, so this only ever
 * needs to describe time that's still ahead). */
function formatCountdown(until: Date, now: number): string {
  const ms = Math.max(0, until.getTime() - now);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** A hold with under a minute left reads as urgent — it's about to lapse
 * and go back on the shelf while this page is still open. */
function isHoldUrgent(until: Date, now: number): boolean {
  return until.getTime() - now < 60_000;
}

/**
 * A clock that actually ticks.
 *
 * Both the countdown and the urgent state are pure functions of "now", and
 * `run` is a static server prop — so without this the numbers froze at
 * whatever they were when the page rendered. A hold would sit reading
 * "0:42" indefinitely, and the red last-minute state this board exists to
 * show would only ever appear if it was already true at load. One second is
 * the resolution the countdown itself displays; nothing here re-reads the
 * database, so a hold that lapses while the page is open still needs a
 * reload to leave the list.
 */
function useNow(active: boolean): number {
  // Starts unset and is filled on mount, so the server render and the first
  // client render agree (they both fall back to render-time `Date.now()`)
  // rather than hydrating against a timestamp a second stale.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now ?? Date.now();
}

/**
 * How much of a hold has already run down, 0–1, or null when there is
 * nothing real to measure against. `start` is the holding order's own
 * `createdAt` (see `RunNumberRow.holdStartedAt`), so this is the actual
 * length of *this* hold rather than the 30-minute default `holdMinutes`
 * happens to use — a hold taken with a different window would otherwise
 * draw a bar that lies. Returns null rather than guessing when the two
 * timestamps can't describe a window.
 */
function holdProgress(start: Date | null, until: Date | null, now: number): number | null {
  if (!start || !until) return null;
  const total = until.getTime() - start.getTime();
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, (now - start.getTime()) / total));
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
  // Only tick while something is actually counting down.
  const now = useNow(held.length > 0);
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
                  <span
                    className={`run-held-time rack-mono${
                      row.reservedUntil && isHoldUrgent(row.reservedUntil, now) ? " is-urgent" : ""
                    }`}
                  >
                    {row.reservedUntil ? formatCountdown(row.reservedUntil, now) : "—"}
                  </span>
                  {(() => {
                    // Drawn beside every held row on the canvas (issue #50).
                    // Omitted entirely rather than drawn empty when the hold's
                    // own window can't be measured — an empty bar would read
                    // as "no time used", which is the opposite of unknown.
                    const progress = holdProgress(row.holdStartedAt, row.reservedUntil, now);
                    if (progress === null) return null;
                    return (
                      <span
                        className={`rack-edbar run-held-bar${
                          row.reservedUntil && isHoldUrgent(row.reservedUntil, now)
                            ? " is-urgent"
                            : ""
                        }`}
                        role="presentation"
                      >
                        <i style={{ width: `${(1 - progress) * 100}%` }} />
                      </span>
                    );
                  })()}
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
                <p
                  className={`run-detail-line rack-mono${
                    isHoldUrgent(selected.reservedUntil, now) ? " is-urgent" : ""
                  }`}
                >
                  {formatCountdown(selected.reservedUntil, now)} left on the hold
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
