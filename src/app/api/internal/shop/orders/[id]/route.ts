import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";
import { getOrderForAdmin } from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/orders/[id] → `{ok, order}`. */
export const GET = withInternalAuth<{ id: string }>(async (_request, { params }) => {
  const order = await getOrderForAdmin(params.id);
  if (!order) return internalError("Order not found.", 404);
  return internalJson({ ok: true, order });
});
