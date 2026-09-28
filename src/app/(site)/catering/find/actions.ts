"use server";

import { getDb } from "@/db/client";
import { findMyOrders } from "@/lib/catering/service";

/** Always resolves `{ok:true}` — see `findMyOrders`'s own note on why. */
export async function findMyOrdersAction(email: string): Promise<{ ok: true }> {
  const db = await getDb();
  await findMyOrders(db, email);
  return { ok: true };
}
