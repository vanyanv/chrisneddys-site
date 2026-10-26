import { internalError, internalJson, parseJsonObject, withInternalAuth } from "@/lib/internalApi";
import { parseSettingsPatch } from "@/lib/internalShop";
import { getStoreSettings } from "@/lib/orders";
import { saveStoreSettingsAsSystem } from "@/lib/settingsAdmin";

export const dynamic = "force-dynamic";

/** GET /api/internal/shop/settings → `{ok, settings}`. */
export const GET = withInternalAuth(async () => {
  return internalJson({ ok: true, settings: await getStoreSettings() });
});

/** POST /api/internal/shop/settings {…StoreSettingsPatch} → `{ok: true, settings}` or `{ok: false, error}`. */
export const POST = withInternalAuth(async (_request, { rawBody }) => {
  const body = parseJsonObject(rawBody);
  if (!body) return internalError("Body must be a JSON object of settings.");
  const parsed = parseSettingsPatch(body);
  if (!parsed.ok) return internalError(parsed.error);
  const result = await saveStoreSettingsAsSystem(parsed.patch);
  return internalJson(result, result.ok ? 200 : 400);
});
