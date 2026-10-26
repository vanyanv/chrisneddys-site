import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { getOrderForAdmin, markShippedAsSystem } from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/orders/[id]/ship → `{ok: true}` or `{ok: false, error}`. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { rawBody, params }) => {
  const body = parseJsonObject(rawBody);
  if (!body || typeof body.carrier !== "string" || typeof body.trackingNumber !== "string") {
    return internalError("Body must be {carrier, trackingNumber} as text.");
  }
  const order = await getOrderForAdmin(params.id);
  if (!order) return internalError("Order not found.", 404);
  // The order layer only checks status; the desk must not ship a pickup
  // order or bag a ship one.
  if (order.fulfilment !== "ship")
    return internalError("This is a pickup order. Mark it ready for pickup instead.");
  const result = await markShippedAsSystem(params.id, {
    carrier: body.carrier,
    trackingNumber: body.trackingNumber,
  });
  return internalJson(result, result.ok ? 200 : 400);
});
