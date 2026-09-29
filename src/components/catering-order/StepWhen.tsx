"use client";

import type { CateringStoreId } from "@/lib/catering/stores";
import type { CateringHours, DaysOff, Fulfilment } from "@/lib/catering/types";
import { slotsForDate, dayStatus } from "@/lib/catering/schedule";
import { Calendar } from "./Calendar";
import { formatTime } from "./SummaryStrip";

/** C3: the calendar, and that day's 30-minute slots. */
export function StepWhen({
  store,
  fulfilment,
  hours,
  daysOff,
  leadHours,
  date,
  time,
  onDate,
  onTime,
  nowMs,
}: {
  store: CateringStoreId;
  fulfilment: Fulfilment;
  hours: CateringHours;
  daysOff: DaysOff;
  leadHours: number;
  date: string | null;
  time: string | null;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
  nowMs: number;
}) {
  const status = date ? dayStatus(date, store, hours, daysOff, nowMs, leadHours) : null;
  const slots = date ? slotsForDate(date, store, hours, daysOff, nowMs, leadHours) : [];

  return (
    <div className="cor-step">
      <h1>When do you need it?</h1>

      <p className="cor-fine">
        We need {leadHours} hours&rsquo; notice, so the earliest open day may be a couple of days
        out.
      </p>

      <Calendar
        store={store}
        hours={hours}
        daysOff={daysOff}
        leadHours={leadHours}
        nowMs={nowMs}
        selected={date}
        onSelect={onDate}
      />

      {date && status === "closed" && (
        <p className="cor-note is-error">
          We&rsquo;re closed that day. Pick another date, or{" "}
          <a href="/contact/" data-catering="">
            message us
          </a>
          .
        </p>
      )}
      {date && status === "too-soon" && (
        <p className="cor-note is-error">
          That&rsquo;s too soon for us to prep — every slot that day is inside our notice window.
          Pick a later date, or{" "}
          <a href="/contact/" data-catering="">
            message us
          </a>{" "}
          if it&rsquo;s urgent.
        </p>
      )}
      {date && status === "past" && <p className="cor-note is-error">That date has passed.</p>}

      {date && status === "open" && (
        <>
          <p className="cor-label">
            {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}{" "}
            &middot; {fulfilment === "delivery" ? "Delivery time" : "Pickup time"}
          </p>
          <div className="cor-slots">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                className={`cor-slot${time === slot ? " is-selected" : ""}`}
                onClick={() => onTime(slot)}
              >
                {formatTime(slot)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function whenComplete(date: string | null, time: string | null): boolean {
  return Boolean(date && time);
}
