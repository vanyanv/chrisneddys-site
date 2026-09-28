"use client";

import { useState } from "react";
import type { CateringStoreId } from "@/lib/catering/stores";
import type { CateringHours, DaysOff } from "@/lib/catering/types";
import { dayStatus } from "@/lib/catering/schedule";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** C3's month calendar: hatched "too soon", struck-through closed, filled
 * selected, everything else open. */
export function Calendar({
  store,
  hours,
  daysOff,
  headcount,
  nowMs,
  selected,
  onSelect,
}: {
  store: CateringStoreId;
  hours: CateringHours;
  daysOff: DaysOff;
  headcount: number;
  nowMs: number;
  selected: string | null;
  onSelect: (dateStr: string) => void;
}) {
  const today = new Date(nowMs);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="cor-cal">
      <div className="cor-cal-nav">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
          }
        >
          &lsaquo;
        </button>
        <p>{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))
          }
        >
          &rsaquo;
        </button>
      </div>
      <div className="cor-cal-grid" role="grid">
        {WEEKDAY_LETTERS.map((l, i) => (
          <span key={`${l}-${i}`} className="cor-cal-dow" aria-hidden="true">
            {l}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null)
            return <span key={`e-${i}`} className="cor-cal-empty" aria-hidden="true" />;
          const dateStr = toDateStr(view.y, view.m, day);
          const status = dayStatus(dateStr, store, hours, daysOff, nowMs, headcount);
          const isSelected = dateStr === selected;
          return (
            <button
              key={dateStr}
              type="button"
              className={`cor-cal-day is-${status}${isSelected ? " is-selected" : ""}`}
              // `aria-disabled`, not the native `disabled` attribute: a
              // closed/too-soon/past day still needs to be clickable so
              // `onSelect` can set `date` and StepWhen can show *why* —
              // "too soon for us to prep", "we're closed that day", "that
              // date has passed", each with a `/contact/` link. A native
              // `disabled` button never fires `onClick` at all, which
              // silently dropped that whole explanation. `aria-disabled`
              // still reads as disabled to assistive tech and to
              // Playwright's `toBeDisabled()`, and selecting a non-open
              // day can never actually complete an order: no slots are
              // offered for it, so `whenComplete` (and Continue) stay
              // blocked regardless.
              aria-disabled={status !== "open" ? "true" : undefined}
              onClick={() => onSelect(dateStr)}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${dateStr}${status !== "open" ? `, ${status.replace("-", " ")}` : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
