/**
 * America/Los_Angeles conversions, done with `Intl` alone (no date library
 * is a dependency of this repo, and phase 1 isn't the place to add one).
 *
 * The one nontrivial piece is turning a wall-clock date + time that's known
 * to be in Los Angeles into a UTC instant, correctly across the DST
 * transitions in March and November. `zonedTimeToUtcMs` below is the
 * standard two-pass trick: guess the UTC instant assuming no offset, read
 * back the LA offset actually in effect at that guess, and correct once
 * more if the two disagree (the fold on transition day is decided by the
 * instant's calendar wall time, not the local rules of any one offset).
 */

export const LA_ZONE = "America/Los_Angeles";

const PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: LA_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type DateParts = { year: number; month: number; day: number; hour: number; minute: number };

/** "YYYY-MM-DD" for a UTC instant, as the calendar date in Los Angeles. */
export function laDateString(atMs: number): string {
  const { year, month, day } = laParts(atMs);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 0 (Sunday) – 6 (Saturday) for a "YYYY-MM-DD" calendar date, no timezone math needed. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function laParts(atMs: number): DateParts {
  const parts = Object.fromEntries(
    PARTS_FORMAT.formatToParts(new Date(atMs)).map((p) => [p.type, p.value]),
  );
  // Midnight can render as hour "24" under hour12: false in some engines.
  const hour = Number(parts.hour) % 24;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

/** The LA UTC offset in effect at `atMs`, in milliseconds (west of UTC is negative). */
function laOffsetMs(atMs: number): number {
  const { year, month, day, hour, minute } = laParts(atMs);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return asIfUtc - atMs;
}

/**
 * The UTC instant (ms) for wall-clock "YYYY-MM-DD" + "HH:MM" in Los Angeles.
 * Correct across the spring-forward and fall-back transitions.
 */
export function zonedTimeToUtcMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naiveUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  const offset = laOffsetMs(naiveUtc);
  let utc = naiveUtc - offset;
  const offset2 = laOffsetMs(utc);
  if (offset2 !== offset) utc = naiveUtc - offset2;
  return utc;
}

export function addMinutes(ms: number, minutes: number): number {
  return ms + minutes * 60_000;
}
