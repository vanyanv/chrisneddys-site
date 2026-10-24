import { GLENDALE_HOURS_FROM, GLENDALE_OPENS_AT } from "@/data/locations";

/**
 * The moments the storefront has to change by itself: the start of Glendale's
 * opening day (its page shows its hours from then) and the 6 PM doors (it is
 * open everywhere from then). Storefront pages re-render only once a day on
 * their own (`revalidate` in `src/app/(site)/layout.tsx`), so the
 * `/api/opening` cron re-renders them at each of these, scheduled in
 * `vercel.json` in UTC.
 */
export const OPENING_MOMENTS = [GLENDALE_HOURS_FROM, GLENDALE_OPENS_AT] as const;

/**
 * How long after a moment the cron may still re-render. Vercel runs a Pro
 * project's cron in its minute, but a Hobby one anywhere in its hour, so the
 * window covers the hour plus some slack. Outside every window the route
 * does nothing, so a stray request can never cost a re-render.
 */
export const REFRESH_WINDOW_MS = 75 * 60 * 1000;

/** The moment `now` falls just after, or null when a re-render is not due. */
export function dueOpeningMoment(now: number = Date.now()): string | null {
  return (
    OPENING_MOMENTS.find((at) => {
      const from = Date.parse(at);
      return now >= from && now < from + REFRESH_WINDOW_MS;
    }) ?? null
  );
}
