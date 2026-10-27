import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { getOrderForAdmin, markRefundedAsSystem } from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/orders/[id]/refund → `{ok: true}` or `{ok: false, error}`. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { rawBody, params }) => {
  const body = parseJsonObject(rawBody, true);
  if (
    !body ||
    (body.reason !== undefined && typeof body.reason !== "string") ||
    (body.release !== undefined && typeof body.release !== "boolean")
  ) {
    return internalError("Body must be {reason?: text, release?: true|false}.");
  }
  if (!(await getOrderForAdmin(params.id))) return internalError("Order not found.", 404);
  const result = await markRefundedAsSystem(params.id, {
    reason: body.reason || undefined,
    release: body.release,
  });
  return internalJson(result, result.ok ? 200 : 400);
});
