import { getProductForAdmin } from "@/lib/catalogAdmin";
import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/products/[id] → `{ok, product}`. */
export const GET = withInternalAuth<{ id: string }>(async (_request, { params }) => {
  const product = await getProductForAdmin(params.id);
  if (!product) return internalError("Product not found.", 404);
  return internalJson({ ok: true, product });
});
