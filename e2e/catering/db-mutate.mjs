#!/usr/bin/env node
/**
 * A tiny direct-DB mutation CLI for the catering e2e specs, run out-of-process
 * (`node e2e/catering/db-mutate.mjs <command> <args...>`) against the same
 * `PGLITE_DATA_DIR` the running app uses — same "plain `node`, same resolve
 * hook" shape as `../db-warmup.mjs` and `../seed-catering.mjs`.
 *
 * Exists because two spec scenarios need an order state the customer UI can
 * never produce on its own:
 *  - the half-refund cancellation tier (24-48h out) — the builder can only
 *    ever book a slot >=48h out, so getting an order to 30h out means moving
 *    its `eventAt` back after the fact.
 *  - the "expired" state — reachable in real life only by the owner not
 *    replying for `replyHours`, so a spec instead sets `respondBy` into the
 *    past and lets the app's own lazy `expireDue` check (on the next order-
 *    link or admin-list load) flip it.
 *
 * Commands:
 *   set-event-at <orderNumber> <isoString>
 *   set-respond-by <orderNumber> <isoString>
 */
import { register } from "node:module";

register("../order-seed-resolve-hook.mjs", import.meta.url);

const { getDb } = await import("../../src/db/client.ts");
const { cateringOrders } = await import("../../src/db/schema.ts");
const { eq } = await import("drizzle-orm");

const [, , command, orderNumber, value] = process.argv;

if (!command || !orderNumber || !value) {
  console.error("usage: db-mutate.mjs <set-event-at|set-respond-by> <orderNumber> <isoString>");
  process.exit(1);
}

const db = await getDb();

const patch =
  command === "set-event-at"
    ? { eventAt: new Date(value) }
    : command === "set-respond-by"
      ? { respondBy: new Date(value) }
      : null;

if (!patch) {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}

const [row] = await db
  .update(cateringOrders)
  .set(patch)
  .where(eq(cateringOrders.number, orderNumber))
  .returning({ id: cateringOrders.id, number: cateringOrders.number });

if (!row) {
  console.error(`no catering order found with number ${orderNumber}`);
  process.exit(1);
}

console.log(`${command} ${row.number} -> ${value}`);
