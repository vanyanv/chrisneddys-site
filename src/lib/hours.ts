import type { Location } from "@/data/locations";

/**
 * Whether a store is open right now, in Los Angeles time.
 *
 * The kitchen closes after midnight — 1 AM Monday through Thursday, 2 AM Friday
 * through Sunday — so "is it open" can't be answered by looking at today's row
 * alone. At 12:30 AM on a Monday the store is open, but on *Sunday's* window.
 * Both the previous day's window and today's are checked.
 *
 * Everything is computed against America/Los_Angeles, not the visitor's clock.
 * Someone checking from New York at 11 PM should see a store that is open, not
 * one that closed two hours ago.
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const LA_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type LaClock = { weekday: string; minutes: number };

/** The wall clock in Los Angeles, whatever clock the visitor is on. */
export function losAngelesNow(at: Date = new Date()): LaClock {
  const parts = Object.fromEntries(
    LA_TIME.formatToParts(at).map((p) => [p.type, p.value]),
  );
  // Some engines render midnight as "24" under hour12: false.
  const hour = Number(parts.hour) % 24;
  return { weekday: String(parts.weekday), minutes: hour * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

type Window = { open: number; close: number };

/**
 * The opening window for one weekday, in minutes from that day's midnight.
 * `close` runs past 1440 when the store shuts after midnight.
 */
function windowFor(loc: Location, weekday: string): Window | null {
  const spec = loc.openingSpec?.find((s) => s.dayOfWeek.includes(weekday));
  if (!spec) return null;
  const open = toMinutes(spec.opens);
  let close = toMinutes(spec.closes);
  if (close <= open) close += 24 * 60;
  return { open, close };
}

const dayBefore = (weekday: string): string =>
  WEEKDAYS[(WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]) + 6) % 7];

const dayAfter = (weekday: string): string =>
  WEEKDAYS[(WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]) + 1) % 7];

export type StoreStatus =
  | { state: "open"; minutesLeft: number; closesAt: string }
  | { state: "last-call"; minutesLeft: number; closesAt: string }
  | { state: "closed"; opensAt: string | null }
  | { state: "unknown" };

/** Last 45 minutes of service. Long enough to still be worth the drive. */
const LAST_CALL_MINUTES = 45;

function clockLabel(minutesFromMidnight: number): string {
  const m = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}

export function storeStatus(loc: Location, at: Date = new Date()): StoreStatus {
  if (!loc.isOpen || !loc.openingSpec?.length) return { state: "unknown" };

  const { weekday, minutes } = losAngelesNow(at);

  // Yesterday's window can still be running; today's may not have started.
  const candidates: Array<{ window: Window | null; elapsed: number }> = [
    { window: windowFor(loc, dayBefore(weekday)), elapsed: minutes + 1440 },
    { window: windowFor(loc, weekday), elapsed: minutes },
  ];

  for (const { window, elapsed } of candidates) {
    if (!window) continue;
    if (elapsed >= window.open && elapsed < window.close) {
      const minutesLeft = window.close - elapsed;
      const closesAt = clockLabel(window.close);
      return minutesLeft <= LAST_CALL_MINUTES
        ? { state: "last-call", minutesLeft, closesAt }
        : { state: "open", minutesLeft, closesAt };
    }
  }

  const today = windowFor(loc, weekday);
  if (today && minutes < today.open) {
    return { state: "closed", opensAt: clockLabel(today.open) };
  }
  const tomorrow = windowFor(loc, dayAfter(weekday));
  return { state: "closed", opensAt: tomorrow ? clockLabel(tomorrow.open) : null };
}

/** Short label for a status pill. */
export function statusLabel(status: StoreStatus): string {
  switch (status.state) {
    case "last-call":
      return `LAST CALL · ${status.minutesLeft}M`;
    case "open": {
      if (status.minutesLeft > 180) return "OPEN";
      const h = Math.floor(status.minutesLeft / 60);
      const m = status.minutesLeft % 60;
      if (h > 0) return m ? `${h}H ${m}M LEFT` : `${h}H LEFT`;
      return `${m}M LEFT`;
    }
    case "closed":
      return "CLOSED";
    default:
      return "";
  }
}

/** The line underneath the pill. */
export function statusDetail(status: StoreStatus): string {
  switch (status.state) {
    case "open":
    case "last-call":
      return `Last call ${status.closesAt}`;
    case "closed":
      return status.opensAt ? `Opens ${status.opensAt}` : "";
    default:
      return "";
  }
}
