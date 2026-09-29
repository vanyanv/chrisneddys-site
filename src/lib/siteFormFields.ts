/**
 * The client-safe half of the site's two public forms — the contact form
 * (`GuestCheck.tsx`) and the opening-list signup (`OpeningNotify.tsx`). Both
 * post to the server actions in `src/lib/siteForms.ts`, which send the
 * submission through Resend; this module holds what the browser and the
 * server both need to agree on: the topics, the length caps, the email
 * check and the result shape.
 */

export const CONTACT_TOPICS = [
  "Catering & events",
  "Press & media",
  "Partnerships",
  "Order issue",
  "Something else",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Longest message the guest check accepts. The textarea enforces it in the
 * browser; the server enforces it again, since anything can POST. */
export const MESSAGE_MAX = 1200;
export const NAME_MAX = 120;
export const PHONE_MAX = 40;
/** RFC 5321's practical ceiling for a whole address. */
export const EMAIL_MAX = 254;

/**
 * What a form action hands back. `reason` is a fixed token, safe to send to
 * analytics as-is — never the provider's message, never anything typed.
 *
 * - `invalid` — the server rejected a field the browser should have caught.
 * - `not_configured` — Resend isn't set up on this deployment.
 * - `throttled` — too many sends from this address in a short window.
 * - `send_failed` — Resend was asked and said no, or could not be reached.
 */
export type SiteFormResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not_configured" | "throttled" | "send_failed" };

/**
 * Deliberately permissive: the only thing worth rejecting in the browser is an
 * address that cannot be delivered to at all. Anything stricter turns real
 * addresses (plus-tags, new TLDs, unicode locals) into a form that will not
 * submit.
 */
export function emailLooksSendable(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
