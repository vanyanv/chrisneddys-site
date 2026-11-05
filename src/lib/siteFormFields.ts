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

/* ---- order issue ---------------------------------------------------------
   Picking "Order issue" opens a few more lines on the check, all optional:
   enough for the owner to find the ticket and see where it went wrong (which
   location, which way it was ordered, when, the order number, what kind of
   problem) without a round of questions first. */

/** The topic that opens the order lines. */
export const ORDER_TOPIC: ContactTopic = "Order issue";

/** In the order the owner names them. Each is a `neighbourhood` in
 * `src/data/locations.ts` (a test holds the two together). */
export const ORDER_LOCATIONS = ["Hollywood", "Van Nuys", "Glendale"] as const;

/** How the order was placed. "Our website" is the Otter ordering link the
 * site's ORDER buttons open; guests don't know it as Otter. */
export const ORDER_CHANNELS = ["In store", "Our website", "DoorDash", "Uber Eats"] as const;

/** What went wrong. More than one can be ticked. */
export const ORDER_PROBLEMS = [
  "Cold",
  "Missing item",
  "Wrong item",
  "Took too long",
  "Quality",
  "Charged wrong",
] as const;

/** Otter, DoorDash and Uber Eats order numbers are a handful of characters;
 * this leaves room for one pasted with a label in front of it. */
export const ORDER_NUMBER_MAX = 40;

/** Form field names for the order lines, shared by the form and the action. */
export const ORDER_FIELDS = {
  store: "orderStore",
  via: "orderVia",
  when: "orderWhen",
  number: "orderNumber",
  problem: "orderProblem",
} as const;

/** Every order line, each empty (or `[]`) when the guest left it blank. */
export type OrderDetails = {
  store: string;
  via: string;
  /** `YYYY-MM-DDTHH:MM` as a `datetime-local` input gives it: the guest's
   * own wall clock, which for these stores is Los Angeles time. */
  when: string;
  number: string;
  problems: string[];
};

const WHEN_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Reads and checks the order lines from a submitted form. `null` means
 * something arrived that the form could not have sent (an unknown location,
 * a garbled date, an over-long number); blank lines are fine.
 */
export function readOrderDetails(data: FormData): OrderDetails | null {
  const get = (k: string) => String(data.get(k) ?? "").trim();
  const store = get(ORDER_FIELDS.store);
  const via = get(ORDER_FIELDS.via);
  const when = get(ORDER_FIELDS.when);
  const number = get(ORDER_FIELDS.number);
  const problems = [...new Set(data.getAll(ORDER_FIELDS.problem).map((v) => String(v)))];

  const oneOf = (list: readonly string[], v: string) => v === "" || list.includes(v);
  if (
    !oneOf(ORDER_LOCATIONS, store) ||
    !oneOf(ORDER_CHANNELS, via) ||
    (when !== "" && !orderWhenLabel(when)) ||
    number.length > ORDER_NUMBER_MAX ||
    !problems.every((p) => (ORDER_PROBLEMS as readonly string[]).includes(p))
  ) {
    return null;
  }
  return { store, via, when, number, problems };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed 10/28 · 8:30 PM" from `2026-10-28T20:30`, read as typed (no
 * timezone shift). Empty when it isn't a real date and time. */
export function orderWhenLabel(when: string): string {
  const m = WHEN_PATTERN.exec(when);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || h > 23 || mi > 59) return "";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${WEEKDAYS[date.getUTCDay()]} ${mo}/${d} · ${h12}:${String(mi).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

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
  | {
      ok: false;
      reason: "invalid" | "not_configured" | "throttled" | "send_failed";
    };

/** Hidden fields the contact form adds on send: how many keys were pressed in
 * the message box, and how long the page had been open (ms). The server uses
 * them to tag a pasted-in-seconds message, never to refuse one — see
 * `contactScreening.ts`. */
export const TYPED_KEYS_FIELD = "typed_keys";
export const OPEN_MS_FIELD = "open_ms";

/**
 * Deliberately permissive: the only thing worth rejecting in the browser is an
 * address that cannot be delivered to at all. Anything stricter turns real
 * addresses (plus-tags, new TLDs, unicode locals) into a form that will not
 * submit.
 */
export function emailLooksSendable(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
