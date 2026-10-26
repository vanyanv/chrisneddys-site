import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";
import {
  ORDERS_ADMIN_FILTERS,
  listOrdersForAdmin,
  type OrdersAdminFilter,
} from "@/lib/ordersAdmin";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/orders?filter=<f>&cursor=<c> → `{ok, rows, nextCursor}`. */
export const GET = withInternalAuth(async (request) => {
  const params = new URL(request.url).searchParams;
  const filter = params.get("filter") ?? "all";
  if (!(ORDERS_ADMIN_FILTERS as string[]).includes(filter)) {
    return internalError(`filter must be one of: ${ORDERS_ADMIN_FILTERS.join(", ")}.`);
  }
  const cursor = params.get("cursor") || undefined;
  const { rows, nextCursor } = await listOrdersForAdmin(filter as OrdersAdminFilter, cursor);
  return internalJson({ ok: true, rows, nextCursor });
});
