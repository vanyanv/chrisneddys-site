/**
 * Confirm-on-return: the Stripe success URL carries `session_id`, so the sent
 * page can finish a `draft` order itself if the webhook hasn't (or can't —
 * the production endpoint may not be configured yet). It runs the same
 * `completeCateringCheckout` the webhook does, which is idempotent (a second
 * call for a no-longer-`draft` order skips the emails), so whichever of the
 * two arrives second changes nothing and nothing is emailed twice.
 *
 * `session_id` is never trusted on its own: the session must be `complete`
 * and its `metadata.cateringOrderId` must be this very order.
 */
import "server-only";
import type { Db } from "@/db/client";
import { completeCateringCheckout } from "./checkoutComplete";
import { retrieveCheckoutSession, type RetrievedCheckoutSession } from "./payments";

export type ConfirmFromReturnDeps = {
  retrieveSession: (id: string) => Promise<RetrievedCheckoutSession | null>;
  complete: typeof completeCateringCheckout;
};

const defaultDeps: ConfirmFromReturnDeps = {
  retrieveSession: retrieveCheckoutSession,
  complete: completeCateringCheckout,
};

/** Returns true when it completed the order just now. */
export async function confirmFromReturn(
  db: Db,
  order: { id: string; status: string },
  sessionId: string | undefined,
  deps: ConfirmFromReturnDeps = defaultDeps,
): Promise<boolean> {
  if (!sessionId || order.status !== "draft") return false;
  const session = await deps.retrieveSession(sessionId);
  if (!session) return false;
  if (session.status !== "complete") return false;
  if (session.cateringOrderId !== order.id) return false;
  await deps.complete(db, {
    orderId: order.id,
    checkoutSessionId: session.id,
    paymentIntentId: session.paymentIntentId,
    customerId: session.customerId,
    paymentMethodId: session.paymentMethodId,
  });
  return true;
}
