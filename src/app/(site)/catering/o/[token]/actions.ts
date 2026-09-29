"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { cancelByCustomer, requestChange, type RequestChangeInput } from "@/lib/catering/service";
import type { ServiceResult } from "@/lib/catering/service";

function isTestEnv(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/** Deferred to `after()` — same reasoning as `saveCateringSettingsAction`
 * (`../../../(admin)/admin/catering/settingsActions.ts`): revalidating
 * inline in the Server Action would render a fresh RSC payload for this
 * page into the action's own response before it resolves, on PGlite's
 * single connection. */
function revalidateOrderPage(token: string) {
  if (isTestEnv()) return;
  after(() => {
    revalidatePath(`/catering/o/${token}/`);
  });
}

export async function cancelOrderAction(token: string): Promise<ServiceResult> {
  const db = await getDb();
  const result = await cancelByCustomer(db, token);
  if (result.ok) {
    revalidateOrderPage(token);
  }
  return result;
}

export async function requestChangeAction(
  token: string,
  input: RequestChangeInput,
): Promise<ServiceResult> {
  const db = await getDb();
  const result = await requestChange(db, token, input);
  if (result.ok) {
    revalidateOrderPage(token);
  }
  return result;
}
