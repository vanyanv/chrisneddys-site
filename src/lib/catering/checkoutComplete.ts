/**
 * The one state transition both `POST /api/catering/checkout` (fake-payments
 * mode, which never sees a webhook) and `POST /api/stripe/webhook`
 * (`checkout.session.completed`, real mode) need to perform identically:
 * attach whichever Stripe ids are now known, move the draft order to
 * `requested`, record the timeline event, and send both the customer's
 * "request received" email and the owner's "new request" email. Kept out of
 * `service.ts` since it isn't one of that module's listed exports — this is
 * checkout-completion plumbing, not an owner/customer-facing action.
 */
import "server-only";
import type { Db } from "@/db/client";
import {
  attachStripeIds,
  getOrderById,
  recordEvent,
  setStatus,
  type StripeIdsPatch,
} from "./orders";
import { getCateringSettings } from "./settings";
import { sendOwnerNewRequestEmail, sendRequestReceivedEmail } from "./emails";

export type CompleteCateringCheckoutInput = StripeIdsPatch & { orderId: string };

/**
 * Idempotent: a second call for an order that's no longer `draft` (a
 * duplicate webhook delivery, or a fake-mode checkout retried) leaves the
 * order and its emails alone — `setStatus`'s own transition table refuses
 * `draft -> requested` a second time, and that refusal is exactly the signal
 * this function uses to skip sending anything twice.
 */
export async function completeCateringCheckout(
  db: Db,
  input: CompleteCateringCheckoutInput,
): Promise<void> {
  const settings = await getCateringSettings(db);
  const now = new Date();
  const respondBy = new Date(now.getTime() + settings.replyHours * 60 * 60 * 1000);

  await attachStripeIds(
    input.orderId,
    {
      checkoutSessionId: input.checkoutSessionId,
      paymentIntentId: input.paymentIntentId,
      customerId: input.customerId,
      paymentMethodId: input.paymentMethodId,
    },
    db,
  );

  const moved = await setStatus(input.orderId, "requested", { requestedAt: now, respondBy }, db);
  if (!moved.ok) return;

  await recordEvent(input.orderId, "requested", "system", undefined, db);

  const order = await getOrderById(input.orderId, db);
  if (!order) return;

  await Promise.all([sendRequestReceivedEmail(order), sendOwnerNewRequestEmail(order, db)]);
}

/** `checkout.session.expired`: the draft never got a card held, so it's just
 * cancelled with no refund/email to send (the customer never saw a
 * confirmation of anything to begin with). */
export async function cancelCateringDraft(db: Db, orderId: string): Promise<void> {
  const moved = await setStatus(orderId, "cancelled", { cancelledAt: new Date() }, db);
  if (moved.ok) {
    await recordEvent(orderId, "cancelled", "system", { reason: "checkout session expired" }, db);
  }
}
