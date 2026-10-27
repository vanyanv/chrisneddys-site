import {
  createDraft,
  listArchivedProductsForAdmin,
  listProductsForAdmin,
} from "@/lib/catalogAdmin";
import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { catalogueChanged } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/products[?archived=1] → `{ok, products}`. */
export const GET = withInternalAuth(async (request) => {
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  const products = archived ? await listArchivedProductsForAdmin() : await listProductsForAdmin();
  return internalJson({ ok: true, products });
});

/** POST /api/internal/shop/products {name} → `{ok: true, id, slug}` (a draft). */
export const POST = withInternalAuth(async (_request, { rawBody }) => {
  const body = parseJsonObject(rawBody);
  if (!body || typeof body.name !== "string") return internalError("Body must be {name: text}.");
  const { id, slug } = await createDraft(body.name);
  catalogueChanged([slug]);
  return internalJson({ ok: true, id, slug });
});
