/**
 * The payments adapter: everything that talks to Stripe for a catering
 * order, plus the "fake payments" test double described in
 * `docs/catering-build-plan.md`. Every function here is safe to call from
 * both the checkout route and `service.ts` — in fake mode none of them ever
 * construct a `Stripe` client, so a test (or Playwright) run with
 * `CATERING_FAKE_PAYMENTS=1` never needs Stripe keys at all.
 *
 * Fake mode is env-gated, not id-gated: whether a given payment intent id
 * looks like a fake one is never consulted — only whether fake mode is on
 * *right now*, matching the build plan ("no Stripe calls" while the flag is
 * set). `isFakePaymentsMode()` is also where the safety rail lives: fake
 * mode requested while `VERCEL_ENV` is set is a thrown error, not a quiet
 * fallback to real Stripe or a quiet no-op — it must be impossible to end up
 * faking payments in a real Vercel environment.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export type AdapterResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/**
 * Whether the fake-payments test double is active. Throws when
 * `CATERING_FAKE_PAYMENTS=1` is set alongside `VERCEL_ENV` (any value Vercel
 * sets it to — production, preview or development) — that combination must
 * never be reachable, so this throws on every call rather than only once at
 * startup.
 */
export function isFakePaymentsMode(): boolean {
  const requested = process.env.CATERING_FAKE_PAYMENTS === "1";
  if (requested && process.env.VERCEL_ENV) {
    throw new Error(
      "CATERING_FAKE_PAYMENTS=1 with VERCEL_ENV set — fake catering payments must never run on Vercel.",
    );
  }
  return requested;
}

function fakeId(prefix: string): string {
  return `${prefix}_fake_${randomBytes(8).toString("hex")}`;
}

function stripeErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Stripe request failed.";
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/** A Stripe Customer per email — reused across an email's orders (Stripe's
 * `customer_email` on the session accomplishes the same "find or create" via
 * `customer_creation: "always"`, but we look one up first so the same
 * shopper doesn't accumulate a new Customer object per order). */
export async function findOrCreateCustomer(email: string, name?: string): Promise<string> {
  if (isFakePaymentsMode()) return fakeId("cus");

  const stripe = getStripe();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const created = await stripe.customers.create({ email, name });
  return created.id;
}

export async function createCateringCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
): Promise<{ id: string; url: string }> {
  const session = await getStripe().checkout.sessions.create(params);
  if (!session.url) throw new Error("Stripe Checkout Session was created with no url.");
  return { id: session.id, url: session.url };
}

// ---------------------------------------------------------------------------
// Capture / cancel / refund
// ---------------------------------------------------------------------------

export async function capturePaymentIntent(paymentIntentId: string): Promise<AdapterResult> {
  if (isFakePaymentsMode() || !paymentIntentId) return { ok: true };
  try {
    await getStripe().paymentIntents.capture(paymentIntentId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: stripeErrorMessage(err) };
  }
}

export async function cancelPaymentIntent(paymentIntentId: string): Promise<AdapterResult> {
  if (isFakePaymentsMode() || !paymentIntentId) return { ok: true };
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: stripeErrorMessage(err) };
  }
}

/** Refunds `amountCents` of a captured payment intent. `amountCents <= 0` is
 * a no-op success — the "none" cancellation tier refunds nothing, and this
 * lets callers skip a Stripe call entirely rather than special-casing it. */
export async function refundPaymentIntent(
  paymentIntentId: string,
  amountCents: number,
): Promise<AdapterResult<{ refundId: string | null }>> {
  if (amountCents <= 0) return { ok: true, refundId: null };
  if (isFakePaymentsMode()) return { ok: true, refundId: fakeId("re") };
  try {
    const refund = await getStripe().refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
    });
    return { ok: true, refundId: refund.id };
  } catch (err) {
    return { ok: false, error: stripeErrorMessage(err) };
  }
}

// ---------------------------------------------------------------------------
// Changes: off-session charge for more, or a fresh manual-capture intent
// ---------------------------------------------------------------------------

export type OffSessionParams = {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  description: string;
};

/** Charges the saved card off-session for a change that costs more, once
 * the original hold is already captured. */
export async function chargeOffSession(
  params: OffSessionParams,
): Promise<AdapterResult<{ paymentIntentId: string }>> {
  if (isFakePaymentsMode()) return { ok: true, paymentIntentId: fakeId("pi") };
  try {
    const intent = await getStripe().paymentIntents.create({
      amount: params.amountCents,
      currency: "usd",
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      off_session: true,
      confirm: true,
      description: params.description,
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    return { ok: false, error: stripeErrorMessage(err) };
  }
}

/** Re-authorizes for a change's new total before the original hold is
 * captured: cancels the old intent and holds a new manual-capture one,
 * off-session (the customer isn't present to confirm it themselves). */
export async function reauthorizeOffSession(
  oldPaymentIntentId: string,
  params: OffSessionParams,
): Promise<AdapterResult<{ paymentIntentId: string }>> {
  if (isFakePaymentsMode()) {
    return { ok: true, paymentIntentId: fakeId("pi") };
  }
  const cancelled = await cancelPaymentIntent(oldPaymentIntentId);
  if (!cancelled.ok) return cancelled;
  try {
    const intent = await getStripe().paymentIntents.create({
      amount: params.amountCents,
      currency: "usd",
      customer: params.customerId,
      payment_method: params.paymentMethodId,
      capture_method: "manual",
      off_session: true,
      confirm: true,
      description: params.description,
    });
    return { ok: true, paymentIntentId: intent.id };
  } catch (err) {
    return { ok: false, error: stripeErrorMessage(err) };
  }
}

/** A fake payment/customer/method id set for the checkout route's fake-mode
 * path, which never talks to Stripe at all (no session, no customer lookup). */
export function fakeCheckoutIds(): {
  paymentIntentId: string;
  customerId: string;
  paymentMethodId: string;
  checkoutSessionId: string;
} {
  return {
    paymentIntentId: fakeId("pi"),
    customerId: fakeId("cus"),
    paymentMethodId: fakeId("pm"),
    checkoutSessionId: fakeId("cs"),
  };
}
