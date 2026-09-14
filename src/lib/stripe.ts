import "server-only";
import Stripe from "stripe";

/**
 * Pinned to the `stripe` SDK's own current default (`Stripe.ApiVersion` at
 * the installed major) rather than left unset — an unset `apiVersion` tracks
 * whatever the account's dashboard default is, which can move out from under
 * this code on its own schedule. Bump this deliberately, together with a
 * `stripe` major upgrade, not by surprise.
 */
const API_VERSION = "2026-08-26.dahlia" satisfies Stripe.LatestApiVersion;

let client: Stripe | null = null;

/**
 * Lazy singleton: constructing a `Stripe` client with no key throws, so this
 * must never run at module load — only once a caller that has already
 * checked `isShopOpen()` (or otherwise knows `STRIPE_SECRET_KEY` is set)
 * actually asks for it.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("getStripe(): STRIPE_SECRET_KEY is not set");
  client = new Stripe(key, { apiVersion: API_VERSION });
  return client;
}
