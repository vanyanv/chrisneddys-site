"use client";

import { CATERING_STORES, type CateringStoreId } from "@/lib/catering/stores";
import type { Fulfilment } from "@/lib/catering/types";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (h === undefined || m === undefined) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** The cream strip under the header from C3 onward: "Van Nuys · Delivery ·
 * Fri Oct 2 · 12:30 PM · 60 people", with an Edit link back to C2/C3.
 * `onEdit` is optional: the order-link page (`/catering/o/[token]/`) reuses
 * this strip read-only from a Server Component, where there's no edit flow
 * to jump back into and — since it's a Server Component — no way to hand
 * this Client Component a real event handler in the first place (an inline
 * function prop crossing that boundary is exactly "Event handlers cannot be
 * passed to Client Component props"). Omitting `onEdit` there just hides
 * the button instead. */
export function SummaryStrip({
  store,
  fulfilment,
  date,
  time,
  headcount,
  onEdit,
}: {
  store: CateringStoreId | null;
  fulfilment: Fulfilment | null;
  date: string | null;
  time: string | null;
  headcount: number;
  onEdit?: () => void;
}) {
  const storeName = CATERING_STORES.find((s) => s.id === store)?.name;
  const parts = [
    storeName,
    fulfilment === "delivery" ? "Delivery" : fulfilment === "pickup" ? "Pickup" : null,
    date ? formatDate(date) : null,
    time ? formatTime(time) : null,
    `${headcount} people`,
  ].filter(Boolean);

  return (
    <div className="cor-summary">
      <p>{parts.join(" · ")}</p>
      {onEdit && (
        <button type="button" className="cor-summary-edit" onClick={onEdit}>
          Edit
        </button>
      )}
    </div>
  );
}

export { formatDate, formatTime };
