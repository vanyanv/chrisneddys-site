import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { applyProductChangesInternal, parseProductChanges } from "@/lib/internalShop";

export const dynamic = "force-dynamic";

/** POST /api/internal/shop/products/[id]/fields {changes} — every change must be for this product. */
export const POST = withInternalAuth<{ id: string }>(async (_request, { rawBody, params }) => {
  const body = parseJsonObject(rawBody);
  const changes = body ? parseProductChanges(body.changes) : null;
  if (!changes) return internalError("Body must be {changes: [{id, field, value}]} (1 to 200).");
  if (changes.some((c) => c.id !== params.id)) {
    return internalError("Every change must be for the product in the URL.");
  }
  const result = await applyProductChangesInternal(changes);
  return internalJson(result, result.ok ? 200 : 400);
});
