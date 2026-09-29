#!/usr/bin/env node
/**
 * Runs once, single-process, before `next build` in playwright.config.ts's
 * `webServer.command`.
 *
 * `src/db/client.ts`'s file-persisted PGlite path (`DATABASE_URL` unset, not
 * a Vitest run) migrates and seeds itself lazily, the first time something
 * calls `getDb()`. Left alone, `next build`'s static-generation step is the
 * first caller — and it runs several pages' generation in parallel worker
 * processes, each importing `src/db/client.ts` fresh and each racing to
 * `mkdir`/migrate/seed the *same* data directory at once. That's corrupted
 * the PGlite data directory outright in testing here (Postgres error
 * "unexpected data beyond EOF in block ... of relation", surfaced as `next
 * build` failing to prerender `/returns`).
 *
 * Doing the migrate+seed once, here, before `next build` starts, means every
 * worker's later `getDb()` call finds the schema and seed already in place
 * and just opens the existing database — no concurrent first-write race.
 *
 * Honours `PGLITE_DATA_DIR` the same way `src/db/client.ts` does (it just
 * calls `getDb()`, which reads that var itself) — playwright.config.ts sets
 * it to `.pglite/e2e`, kept separate from the developer's own `.pglite/dev`.
 *
 * Also seeds five orders against `foam-trucker-blue` (the one product
 * `seedCatalogue` creates): four `e2e/admin-orders.spec.ts` needs — one of
 * each fulfilment/status combination the orders sheet distinguishes
 * (paid-ship, paid-pickup, fulfilled-ship, ready-pickup) — plus a fifth left
 * `pending` and never paid, so `e2e/admin-run.spec.ts` has a real number
 * held in an open checkout to look at rather than only sold ones. Skipped
 * when the `orders` table already has rows (a `webServer.reuseExistingServer`
 * local rerun, e.g.), so this stays idempotent the same way `seedCatalogue`
 * is.
 *
 * Also seeds the owner account `e2e/helpers.ts`'s `signInAsOwner()` (and
 * `e2e/admin-owner-accounts.spec.ts`) signs in with, by inserting the
 * `user` row and its `credential` `account` row directly — the same shape
 * `src/lib/auth.ts`'s `bootstrapFirstOwnerIfNeeded` would create, and the
 * same insert shape `src/lib/auth.test.ts` uses to seed an account for its
 * own sign-in tests. This used to happen instead via
 * `playwright.config.ts`'s `webServer.env` setting `OWNER_PASSWORD_HASH`
 * and relying on that bootstrap path to consume it on the very first
 * sign-in — but that path only fires while the `user` table is still
 * empty, so seeding here beats it there anyway once the table already has
 * a row, and doing it here means real sign-in never depends on
 * `OWNER_PASSWORD_HASH` reaching the running server intact (see
 * playwright.config.ts's comment on why that value used to need `$`
 * escaping, and why it no longer does). Skipped when a `user` row with
 * this email already exists, for the same idempotency reason as the order
 * seed above.
 */
import { randomUUID } from "node:crypto";
import { register } from "node:module";
import { eq } from "drizzle-orm";

// See order-seed-resolve-hook.mjs: makes `@/...` and `next/cache` resolvable
// to plain `node`, so `../src/lib/orders.ts` below can be imported as-is.
register("./order-seed-resolve-hook.mjs", import.meta.url);

const { getDb } = await import("../src/db/client.ts");
const { orders, user, account } = await import("../src/db/schema.ts");
const { createPendingOrder, markPaid, markReadyForPickup, setFulfilment } =
  await import("../src/lib/orders.ts");
const { hashPassword } = await import("../src/lib/password.ts");

// Must match `e2e/helpers.ts`'s `OWNER_EMAIL`/`OWNER_PASSWORD` exactly —
// that's what `signInAsOwner()` and every owner-accounts spec sign in with.
const OWNER_EMAIL = "owner@example.com";
const OWNER_PASSWORD = "e2e-test-password-123";

const db = await getDb();

const existingOwner = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, OWNER_EMAIL))
  .limit(1);
if (existingOwner.length === 0) {
  console.log("Seeding e2e owner account…");
  await seedOwner();
  console.log("e2e owner account seeded.");
} else {
  console.log("e2e owner account already present — skipping seed.");
}

const existingOrder = await db.select({ id: orders.id }).from(orders).limit(1);
if (existingOrder.length === 0) {
  console.log("Seeding e2e orders…");
  await seedOrders();
  console.log("e2e orders seeded.");
} else {
  console.log("e2e orders already present — skipping seed.");
}

async function seedOwner() {
  const userId = randomUUID();
  await db.insert(user).values({
    id: userId,
    name: OWNER_EMAIL.split("@")[0],
    email: OWNER_EMAIL,
    emailVerified: false,
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(OWNER_PASSWORD),
  });
}

async function seedOrders() {
  const SLUG = "foam-trucker-blue";

  // 1) ship order, left "paid" -> list shows "TO SHIP", detail shows the
  //    carrier/tracking form.
  const ship = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 2 }],
    fulfilment: "ship",
  });
  if ("code" in ship) throw new Error(`seed ship order failed: ${ship.code}`);
  await markPaid({
    orderId: ship.orderId,
    paymentIntentId: `pi_test_${ship.number}`,
    email: "buyer.ship@example.com",
    name: "Jordan Ship",
    amounts: { subtotal: 9600, shipping: 600, tax: 450, total: 10650 },
  });

  // 2) pickup order, left "paid" -> list shows "TO PREPARE", detail shows
  //    "Mark ready for pickup".
  const pickup = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "pickup",
  });
  if ("code" in pickup) throw new Error(`seed pickup order failed: ${pickup.code}`);
  await markPaid({
    orderId: pickup.orderId,
    paymentIntentId: `pi_test_${pickup.number}`,
    email: "buyer.pickup@example.com",
    name: "Casey Pickup",
    amounts: { subtotal: 4800, shipping: 0, tax: 220, total: 5020 },
  });

  // 3) ship order, already fulfilled -> list shows "DONE", detail shows the
  //    carrier/tracking readout + "Mark refunded".
  const shipped = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "ship",
  });
  if ("code" in shipped) throw new Error(`seed shipped order failed: ${shipped.code}`);
  await markPaid({
    orderId: shipped.orderId,
    paymentIntentId: `pi_test_${shipped.number}`,
    email: "buyer.shipped@example.com",
    name: "Riley Shipped",
    amounts: { subtotal: 4800, shipping: 600, tax: 220, total: 5620 },
  });
  await setFulfilment(shipped.orderId, { carrier: "USPS", trackingNumber: "9400111899223344" });

  // 4) pickup order, already ready -> list shows "READY", detail shows
  //    "Mark picked up".
  const ready = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "pickup",
  });
  if ("code" in ready) throw new Error(`seed ready order failed: ${ready.code}`);
  await markPaid({
    orderId: ready.orderId,
    paymentIntentId: `pi_test_${ready.number}`,
    email: "buyer.ready@example.com",
    name: "Morgan Ready",
    amounts: { subtotal: 4800, shipping: 0, tax: 220, total: 5020 },
  });
  await markReadyForPickup(ready.orderId);

  // 5) left pending, never paid -> a number is "held" in an open checkout
  //    right now, for `e2e/admin-run.spec.ts`'s run board (issue #36 phase
  //    3, "All fifty numbers") to have a real reserved number to show
  //    alongside the four sold ones above. Deliberately not `markPaid`'d —
  //    this is a guest still mid-checkout, so `orders.email`/`.name` stay
  //    null, same as a real abandoned cart looks right after Stripe
  //    Checkout redirects the buyer away and before they ever come back.
  const held = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "ship",
  });
  if ("code" in held) throw new Error(`seed held order failed: ${held.code}`);
}
