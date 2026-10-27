import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { isProductStatus, setProductStatusInternal } from "@/lib/internalShop";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/products/[id]/status {status} → `{ok: true}` or `{ok: false, error}`. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { rawBody, params }) => {
  const body = parseJsonObject(rawBody);
  if (!body || !isProductStatus(body.status)) {
    return internalError('Body must be {status: "draft" | "published" | "archived"}.');
  }
  const result = await setProductStatusInternal(params.id, body.status);
  if (result.ok) return internalJson(result);
  return internalError(result.error, result.error === "Product not found." ? 404 : 400);
});
