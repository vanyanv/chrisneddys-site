import "server-only";

/**
 * Whether the shop can take money.
 *
 * True only once both Stripe env vars are set: `STRIPE_SECRET_KEY` (to
 * create a Checkout Session) and `STRIPE_WEBHOOK_SECRET` (to verify the
 * webhook that marks an order paid). Half a Stripe setup — a secret key
 * with no webhook secret — is not an open shop: without the webhook, a
 * successful payment would never flip an order to `paid` or assign an
 * edition number, so checkout has to stay closed until both exist.
 *
 * Server-only by design (`import "server-only"` throws if a client
 * component ever imports this module): neither env var is public, and a
 * client component that needs this value gets it as a prop from a server
 * component instead — see the `(site)` root layout, which reads this once
 * and passes `shopOpen` down to `BagDrawer`.
 */
export function isShopOpen(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
