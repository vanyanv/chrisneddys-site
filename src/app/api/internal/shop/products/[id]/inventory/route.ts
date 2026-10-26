import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { setQuantityInternal } from "@/lib/internalShop";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/products/[id]/inventory {count} — quantity-mode products only. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { rawBody, params }) => {
  const body = parseJsonObject(rawBody);
  if (!body) return internalError("Body must be {count: number}.");
  const { notFound, ...result } = await setQuantityInternal(params.id, body.count);
  if (result.ok) return internalJson(result);
  return internalError(result.error, notFound ? 404 : 400);
});
