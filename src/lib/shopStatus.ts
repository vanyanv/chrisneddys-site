import "server-only";
import type { StoreSettings } from "@/lib/orders";

/**
 * Whether Stripe is configured well enough to take money.
 *
 * True only once both Stripe env vars are set: `STRIPE_SECRET_KEY` (to
 * create a Checkout Session) and `STRIPE_WEBHOOK_SECRET` (to verify the
 * webhook that marks an order paid). Half a Stripe setup — a secret key
 * with no webhook secret — is not enough: without the webhook, a
 * successful payment would never flip an order to `paid` or assign an
 * edition number.
 *
 * This is necessary but not sufficient for the shop to be open — see
 * `isShopOpenFor`, which also requires a published returns policy and a
 * support email before checkout can go live.
 *
 * Server-only by design (`import "server-only"` throws if a client
 * component ever imports this module): neither env var is public, and a
 * client component that needs this value gets it as a prop from a server
 * component instead — see the `(site)` root layout, which reads this once
 * and passes `shopOpen` down to `BagDrawer`.
 */
export function hasPaymentKeys(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Whether the shop can actually take an order right now.
 *
 * True only once `hasPaymentKeys()` is true *and* the owner has published a
 * returns policy (`settings.returnsPolicy`) *and* set a support email
 * (`settings.supportEmail`) in `/admin/settings`. A Stripe key with no
 * returns policy is not an open shop: California Civil Code §1723 requires
 * the refund policy be shown before purchase, and `/returns` says outright
 * that checkout stays closed until it is published — this predicate is what
 * makes that true instead of aspirational. `/terms` makes the same promise
 * about `termsText`, but a terms-of-sale page is optional copy, not a legal
 * precondition for taking payment, so it is not part of this gate.
 *
 * Every caller that can reach a `StoreSettings` row should use this instead
 * of `hasPaymentKeys()` alone — the `(site)` root layout, the checkout
 * route, and (threaded through as a plain boolean) `merchLd.ts`.
 */
export function isShopOpenFor(settings: StoreSettings): boolean {
  return (
    hasPaymentKeys() &&
    Boolean(settings.returnsPolicy?.trim()) &&
    Boolean(settings.supportEmail?.trim())
  );
}

/**
 * What is still keeping checkout closed, in the owner's words — one line per
 * missing piece, in the order `isShopOpenFor` checks them. Empty exactly when
 * `isShopOpenFor(settings)` is true. `/admin/settings` lists these on its
 * "The shop is closed" card so the owner knows which setting to fix rather
 * than having to guess which of four it is.
 */
export function shopClosedReasons(settings: StoreSettings): string[] {
  const reasons: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY) {
    reasons.push("STRIPE_SECRET_KEY is not set in Vercel.");
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    reasons.push("STRIPE_WEBHOOK_SECRET is not set in Vercel.");
  }
  if (!settings.returnsPolicy?.trim()) reasons.push("No returns policy is set below.");
  if (!settings.supportEmail?.trim()) reasons.push("No support email is set below.");
  return reasons;
}

/**
 * Whether the owner has deliberately paused a shop that is otherwise open.
 *
 * This is a second, separate gate from `isShopOpenFor` and is never folded
 * into it. Pre-launch (`isShopOpenFor` false) is a one-way readiness check
 * with no switch behind it — it flips once, permanently, the day Stripe
 * keys, a returns policy and a support email are all finally in place, and
 * every caller that reads it shows the "isn't taking orders yet" copy that
 * assumes the shop has simply never opened. Pausing is the opposite motion:
 * deliberate, reachable only once the shop has already gone live, and
 * meant to be flipped back off in a few days — an owner shutting the
 * counter without breaking their Stripe config or reverting the site to
 * its pre-launch state. Keeping the two booleans (and their customer-facing
 * copy — see `shopCopy.ts`'s `pauseNotice`/`pauseCheckoutMessage` versus
 * `TERMS_PENDING`) apart is what lets a buyer, and the owner's own
 * `/admin/settings` page, tell "we haven't opened yet" from "we're closed
 * for a couple of days" instead of collapsing both into one generic
 * "not open" state.
 *
 * A caller deciding whether an order can go through right now should check
 * both: `isShopOpenFor(settings) && !isShopPausedFor(settings)`.
 */
export function isShopPausedFor(settings: StoreSettings): boolean {
  return settings.shopPaused;
}
