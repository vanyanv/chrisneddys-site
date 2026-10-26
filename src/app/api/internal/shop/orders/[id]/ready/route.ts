import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";
import { getOrderForAdmin, markReadyForPickupAsSystem } from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/orders/[id]/ready → `{ok: true}` or `{ok: false, error}`. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { params }) => {
  const order = await getOrderForAdmin(params.id);
  if (!order) return internalError("Order not found.", 404);
  // The order layer only checks status; the desk must not ship a pickup
  // order or bag a ship one.
  if (order.fulfilment !== "pickup")
    return internalError("This order ships. Mark it shipped instead.");
  const result = await markReadyForPickupAsSystem(params.id);
  return internalJson(result, result.ok ? 200 : 400);
});
