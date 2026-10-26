import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";
import { getOrderForAdmin, markReadyForPickupAsSystem } from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/orders/[id]/ready → `{ok: true}` or `{ok: false, error}`. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { params }) => {
  if (!(await getOrderForAdmin(params.id))) return internalError("Order not found.", 404);
  const result = await markReadyForPickupAsSystem(params.id);
  return internalJson(result, result.ok ? 200 : 400);
});
