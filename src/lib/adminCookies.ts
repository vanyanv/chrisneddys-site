/**
 * Cookie names shared between `src/middleware.ts` (edge runtime) and
 * `src/lib/auth.ts` (node). Its own module precisely so the middleware can
 * import a name without dragging in Better Auth, Drizzle or the database
 * client, none of which run on the edge.
 */

/**
 * Set for a year on a successful sign-in, and never cleared — it records
 * only that *this browser has signed in at some point*, which is why it is
 * safe to keep: no session value, no identity, nothing an attacker gains by
 * reading it.
 *
 * It exists to keep one message honest. A 12-hour session
 * (`SESSION_MAX_AGE_SECONDS`) expires by the browser dropping the session
 * cookie, so an owner whose session ran out and an owner who has never
 * signed in here both arrive at a protected path carrying no session cookie
 * at all — indistinguishable at the redirect. Without this marker the
 * sign-in page would greet a first-time visitor with "You were signed out",
 * which is simply untrue. With it, that explanation is shown only to a
 * browser that really did have a session once.
 */
export const SIGNED_IN_BEFORE_COOKIE = "rack_seen";

/** One year. Deliberately far longer than a session: the whole point is to
 * outlive the session cookie it is used to reason about. */
export const SIGNED_IN_BEFORE_MAX_AGE = 60 * 60 * 24 * 365;
