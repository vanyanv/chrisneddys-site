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
  const parts = Object.fromEntries(LA_TIME.formatToParts(at).map((p) => [p.type, p.value]));
  // Some engines render midnight as "24" under hour12: false.
  const hour = Number(parts.hour) % 24;
  return { weekday: String(parts.weekday), minutes: hour * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string): number => {
  // Malformed input already produced NaN before this fallback (undefined * 60
  // is NaN); the fallback only satisfies the type, it doesn't change the result.
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? NaN) * 60 + (m ?? NaN);
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

// `% 7` always lands in range for the 7-entry WEEKDAYS tuple; the fallback to
// WEEKDAYS[0] only satisfies the type for a dynamic index and is never hit.
const dayBefore = (weekday: string): string =>
  WEEKDAYS[(WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]) + 6) % 7] ?? WEEKDAYS[0];

const dayAfter = (weekday: string): string =>
  WEEKDAYS[(WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]) + 1) % 7] ?? WEEKDAYS[0];

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

/**
 * A run of consecutive days, said the way a person says a range out loud: one
 * day is just itself, two days are "X and Y", three or more become
 * "X through Y" — the same shape `openingSpec` already groups its days into,
 * so this never has to know which days those are.
 */
function dayRangeLabel(days: readonly string[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length <= 1) return first ?? "";
  if (days.length === 2) return `${first} and ${last}`;
  return `${first} through ${last}`;
}

/**
 * The hours prose that used to be hand-typed at every site that mentions when
 * the kitchen closes — FAQs, metadata descriptions, store copy. Derived from
 * `loc.openingSpec` (the same groups `windowFor` reads for open/closed logic)
 * so the wording can never drift from the data the live status pill uses.
 *
 * A location with no `openingSpec` yet (not open) has nothing to summarize,
 * so this returns "" rather than a sentence claiming hours it doesn't have —
 * callers only reach for it once `loc.isOpen` is true.
 */
export function closingSummary(loc: Location): string {
  const groups = loc.openingSpec ?? [];
  return groups
    .map((g) => `${clockLabel(toMinutes(g.closes))} ${dayRangeLabel(g.dayOfWeek)}`)
    .join(", ");
}

/**
 * The fuller line for the surfaces that want both ends of the window, not
 * just the close — a metadata description or a "what time are you open" FAQ
 * answer. Reads as a clause to be dropped into a sentence ("is open
 * <this>."), not a standalone sentence, so callers keep control of the verb.
 */
export function hoursSentence(loc: Location): string {
  const groups = loc.openingSpec ?? [];
  return groups
    .map(
      (g) =>
        `${clockLabel(toMinutes(g.opens))} to ${clockLabel(toMinutes(g.closes))} ${dayRangeLabel(g.dayOfWeek)}`,
    )
    .join(", and ");
}
