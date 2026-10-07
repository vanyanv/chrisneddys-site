/**
 * "Now" for the crew closing page. Production is always the server clock.
 * On a Vercel preview and in local development, `?at=HH:MM` pretends it is
 * that Los Angeles wall-clock time during the current business night (times
 * before 06:00 are after midnight), so a reviewer can click through the lock,
 * open and closed screens without waiting for 1 AM.
 */
import { addDays, businessDate, laInstant } from "./night";

type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams | undefined;

function readAt(searchParams: SearchParams): string | undefined {
  if (!searchParams) return undefined;
  if (searchParams instanceof URLSearchParams) return searchParams.get("at") ?? undefined;
  const v = searchParams.at;
  return Array.isArray(v) ? v[0] : v;
}

export function closingNow(
  searchParams: SearchParams,
  now: Date = new Date(),
  env: { VERCEL_ENV?: string; NODE_ENV?: string } = process.env,
): Date {
  if (env.VERCEL_ENV !== "preview" && env.NODE_ENV !== "development") return now;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(readAt(searchParams) ?? "");
  if (!m) return now;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const night = businessDate(now);
  return laInstant(hh < 6 ? addDays(night, 1) : night, hh, mm);
}
