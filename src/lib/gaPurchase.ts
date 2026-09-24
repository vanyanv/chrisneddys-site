import "server-only";

import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import type { OrderWithItems } from "@/lib/orders";

type CheckoutGaMetadata = { gaClientId?: string; gaSessionId?: string } | null;

/**
 * Report a confirmed Stripe payment even when the buyer closes Checkout
 * before returning to our thank-you page. GA4 deduplicates purchase events by
 * transaction_id if the browser fallback also reports the same order.
 */
export async function sendConfirmedPurchase(
  order: OrderWithItems,
  metadata: CheckoutGaMetadata,
): Promise<boolean> {
  const secret = process.env.GA4_API_SECRET;
  const clientId = metadata?.gaClientId;
  if (!secret || !clientId || !/^\d{1,12}\.\d{1,12}$/.test(clientId)) return false;

  const sessionId = metadata?.gaSessionId;
  const params = {
    transaction_id: order.number,
    currency: order.currency.toUpperCase(),
    value: order.subtotalCents / 100,
    shipping: order.shippingCents / 100,
    tax: order.taxCents / 100,
    ...(sessionId && /^\d{1,16}$/.test(sessionId) ? { session_id: sessionId } : {}),
    engagement_time_msec: 1,
    items: order.items.map((item) => ({
      item_id: item.product.slug,
      item_name: item.productName,
      item_variant: item.sku,
      price: item.unitPriceCents / 100,
      quantity: item.quantity,
    })),
  };

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", GA_MEASUREMENT_ID);
  url.searchParams.set("api_secret", secret);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, events: [{ name: "purchase", params }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`GA4 purchase request failed (${response.status})`);
  return true;
}
