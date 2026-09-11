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

/**
 * A time of day, written the way we say it out loud.
 *
 * On the hour the zeroes are noise, and the header has no width to spend on
 * noise: "1 AM", not "1:00 AM". Minutes survive whenever they are not zero, so
 * a store that one day closes at 12:30 still prints correctly with no change
 * here.
 */
function clockLabel(minutesFromMidnight: number): string {
  const m = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = m % 60;
  const meridiem = h24 < 12 ? "AM" : "PM";
  return mm === 0 ? `${h} ${meridiem}` : `${h}:${String(mm).padStart(2, "0")} ${meridiem}`;
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

/**
 * The two cells of the status tag, plus the sentence a screen reader gets.
 *
 * The tag is a punch card: a display-face cell naming the state, and a mono
 * cell carrying the one fact that state implies. "OPEN" on its own answers a
 * question nobody arrives with — at 11:40 on a Tuesday the question is how
 * long is left, and the answer worth giving is the closing time, not a
 * countdown the reader has to subtract from a clock they cannot see.
 *
 * Each cell is split again, because a phone header is 375px wide and the
 * wordmark sits in the middle of it. `rest` and `lead` are the parts the
 * stylesheet drops as the viewport narrows: "LAST CALL" becomes "LAST",
 * "TILL 1 AM" becomes "1 AM". Both are real words, not abbreviations, so
 * nothing has to be decoded at the size where decoding is hardest.
 */
export type StatusParts = {
  /** Display cell. `short` is what survives on the narrowest phones. */
  state: { short: string; rest: string };
  /** Mono cell. `lead` is the connective word the phone drops. */
  time: { lead: string; value: string };
  /** The whole thing as a sentence. This is the accessible name. */
  aria: string;
};

const EMPTY_PARTS: StatusParts = {
  state: { short: "", rest: "" },
  time: { lead: "", value: "" },
  aria: "",
};

export function statusParts(status: StoreStatus): StatusParts {
  switch (status.state) {
    case "open":
      return {
        state: { short: "OPEN", rest: "" },
        time: { lead: "TILL", value: status.closesAt },
        aria: `Open until ${status.closesAt}`,
      };
    case "last-call":
      return {
        state: { short: "LAST", rest: " CALL" },
        // The countdown earns its place here and only here: inside the last
        // 45 minutes it is a decision window, not something to plan around.
        time: { lead: "", value: `${status.minutesLeft} MIN` },
        aria: `Last call, ${status.minutesLeft} minutes left`,
      };
    case "closed":
      return status.opensAt
        ? {
            state: { short: "CLOSED", rest: "" },
            time: { lead: "OPENS", value: status.opensAt },
            aria: `Closed, opens ${status.opensAt}`,
          }
        : { ...EMPTY_PARTS, state: { short: "CLOSED", rest: "" }, aria: "Closed" };
    default:
      return EMPTY_PARTS;
  }
}

/** One line, for the surfaces that have a single text slot: map callouts, the dock. */
export function statusLabel(status: StoreStatus): string {
  const { state, time } = statusParts(status);
  const word = `${state.short}${state.rest}`;
  if (!time.value) return word;
  const fact = time.lead ? `${time.lead} ${time.value}` : time.value;
  return status.state === "open" ? `${word} ${fact}` : `${word} · ${fact}`;
}
