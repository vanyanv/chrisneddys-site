import { listCustomersForAdmin } from "@/lib/customersAdmin";
import { internalJson, withInternalAuth } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/customers → `{ok, customers}`. */
export const GET = withInternalAuth(async () => {
  return internalJson({ ok: true, customers: await listCustomersForAdmin() });
});
