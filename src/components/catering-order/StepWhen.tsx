"use client";

import type { CateringStoreId } from "@/lib/catering/stores";
import type { CateringHours, DaysOff, Fulfilment } from "@/lib/catering/types";
import { slotsForDate, dayStatus } from "@/lib/catering/schedule";
import { Calendar } from "./Calendar";
import { formatTime } from "./SummaryStrip";

/** C3: headcount, the calendar, and that day's 30-minute slots. */
export function StepWhen({
  store,
  fulfilment,
  hours,
  daysOff,
  bigHeadcount,
  bigLeadHours,
  headcount,
  onHeadcount,
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
  bigHeadcount: number;
  bigLeadHours: number;
  headcount: number;
  onHeadcount: (n: number) => void;
  date: string | null;
  time: string | null;
  onDate: (d: string) => void;
  onTime: (t: string) => void;
  nowMs: number;
}) {
  const status = date ? dayStatus(date, store, hours, daysOff, nowMs, headcount) : null;
  const slots = date ? slotsForDate(date, store, hours, daysOff, nowMs, headcount) : [];
  const isBig = headcount >= bigHeadcount;

  return (
    <div className="cor-step">
      <h1>When and how many?</h1>

      <p className="cor-label">How many people?</p>
      <div className="cor-stepper">
        <button
          type="button"
          aria-label="Fewer people"
          onClick={() => onHeadcount(Math.max(1, headcount - 5))}
        >
          &minus;
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={headcount}
          onChange={(e) => onHeadcount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          aria-label="Number of people"
        />
        <button type="button" aria-label="More people" onClick={() => onHeadcount(headcount + 5)}>
          +
        </button>
      </div>

      {isBig && (
        <p className="cor-note">
          {bigHeadcount}+ people needs {bigLeadHours} hours&rsquo; notice, so the earliest open day
          may be a few days out.
        </p>
      )}

      <Calendar
        store={store}
        hours={hours}
        daysOff={daysOff}
        headcount={headcount}
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
