import { getCustomerForAdmin } from "@/lib/customersAdmin";
import { internalError, internalJson, withInternalAuth } from "@/lib/internalApi";

export const dynamic = "force-dynamic";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** GET /api/internal/shop/customers/[key] → `{ok, customer}`; key is the URL-encoded email. */
export const GET = withInternalAuth<{ key: string }>(async (_request, { params }) => {
  const customer = await getCustomerForAdmin(safeDecode(params.key));
  if (!customer) return internalError("Customer not found.", 404);
  return internalJson({ ok: true, customer });
});
