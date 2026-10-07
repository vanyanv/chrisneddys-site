/**
 * Pure time rules for the nightly closing checklist. No database.
 *
 * A "business night" is named for the calendar date it started on, in Los
 * Angeles: the crew that closes at 1 AM Wednesday is closing Tuesday's night.
 * Anything before 06:00 LA time still belongs to the previous date.
 */
import type { Location } from "@/data/locations";

const TZ = "America/Los_Angeles";
const NIGHT_STARTS_HOUR = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WALL = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type Wall = { y: number; mo: number; d: number; h: number; mi: number };

function wallOf(at: Date): Wall {
  const p = Object.fromEntries(WALL.formatToParts(at).map((x) => [x.type, Number(x.value)]));
  return { y: p.year!, mo: p.month!, d: p.day!, h: p.hour! % 24, mi: p.minute! };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, mo: number, d: number) => `${y}-${pad(mo)}-${pad(d)}`;

/** Adds whole days to a `YYYY-MM-DD` string (calendar arithmetic, no zones). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/**
 * The instant at which the Los Angeles wall clock reads `date` `hh:mm`.
 * Tries both LA offsets (-8h, -7h) and keeps those that round-trip. When the
 * wall time happens twice (fall back) the first occurrence wins; when it never
 * happens (spring forward, e.g. 02:00) the PST reading is used, which lands
 * on 03:00 PDT.
 */
export function laInstant(date: string, hh: number, mm: number): Date {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, hh, mm);
  const candidates = [7, 8].map((off) => new Date(asUtc + off * 3600_000));
  const hits = candidates.filter((c) => {
    const w = wallOf(c);
    return w.y === y && w.mo === mo && w.d === d && w.h === hh && w.mi === mm;
  });
  if (hits.length > 0) return hits[0]!;
  return candidates[1]!;
}

/** `YYYY-MM-DD` of the business night `at` belongs to (LA time, 06:00 cutover). */
export function businessDate(at: Date): string {
  const w = wallOf(at);
  const date = ymd(w.y, w.mo, w.d);
  return w.h < NIGHT_STARTS_HOUR ? addDays(date, -1) : date;
}

export type ClosingWindow = { opensAt: Date; closesAt: Date; endsAt: Date };

/**
 * When the checklist can be sent for `date`: from `opensBeforeMin` before
 * close until `graceMin` after. Close time comes from the location's
 * `openingSpec` for that date's weekday; a close earlier than the open is
 * after midnight, i.e. the next calendar day. `null` if the location is
 * closed that weekday (or has no hours).
 */
export function closingWindow(
  loc: Location,
  date: string,
  opts: { opensBeforeMin: number; graceMin: number },
): ClosingWindow | null {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]!;
  const spec = loc.openingSpec?.find((s) => s.dayOfWeek.includes(weekday));
  if (!spec) return null;
  const [oh, om] = spec.opens.split(":").map(Number) as [number, number];
  const [ch, cm] = spec.closes.split(":").map(Number) as [number, number];
  const afterMidnight = ch * 60 + cm < oh * 60 + om;
  const closesAt = laInstant(afterMidnight ? addDays(date, 1) : date, ch, cm);
  return {
    closesAt,
    opensAt: new Date(closesAt.getTime() - opts.opensBeforeMin * 60_000),
    endsAt: new Date(closesAt.getTime() + opts.graceMin * 60_000),
  };
}

export type WindowState = "before" | "open" | "after";

export function windowState(now: Date, w: ClosingWindow): WindowState {
  if (now < w.opensAt) return "before";
  return now <= w.endsAt ? "open" : "after";
}

/** The last `n` business dates up to and including tonight's, newest first. */
export function recentBusinessDates(now: Date, n: number): string[] {
  const latest = businessDate(now);
  return Array.from({ length: n }, (_, i) => addDays(latest, -i));
}
