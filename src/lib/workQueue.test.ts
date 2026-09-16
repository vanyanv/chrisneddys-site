/**
 * `src/lib/workQueue.ts` against a real (PGlite) database — the same
 * migrate/seed setup `src/lib/orders.test.ts` uses. Tests build up state
 * across a single describe block rather than resetting the database
 * between each one (same reasoning as `orders.test.ts`'s threaded
 * `order1Id`/`order2Id`): setup, to-pack, stale-order and held-editions
 * items are meant to be independent and additive, and the final test checks
 * all four appearing together, in order.
 */
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { orders } from "@/db/schema";
import { createPendingOrder, markPaid } from "@/lib/orders";
import { getWorkQueue } from "@/lib/workQueue";

// `setupChecklist.ts` (read by `getWorkQueue`) and the `@/lib/auth` it pulls
// in both carry `import "server-only"`, which throws outside a real
// Next.js server build — see the same note in setupChecklist.test.ts.
vi.mock("server-only", () => ({}));

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

// Every env var a checklist item this queue surfaces depends on.
// `owner-sign-in`'s three (AUTH_SECRET/OWNER_EMAILS/OWNER_PASSWORD_HASH)
// are deliberately excluded — `getWorkQueue` always skips that item.
const ENV_KEYS = [
  "DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    // Every test starts from "fully configured" so it only has to unset
    // the one thing it's exercising.
    process.env[key] = "test-value";
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

async function createPaidOrder(fulfilment: "ship" | "pickup") {
  const reservation = await createPendingOrder({
    items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
    fulfilment,
  });
  if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

  await markPaid({
    orderId: reservation.orderId,
    paymentIntentId: `pi_${reservation.number}`,
    email: "buyer@example.com",
    name: "Test Buyer",
    amounts: { subtotal: 4800, shipping: 600, tax: 0, total: 5400 },
  });

  return reservation;
}

async function setPaidAt(orderId: string, when: Date): Promise<void> {
  const db = await getDb();
  await db.update(orders).set({ paidAt: when }).where(eq(orders.id, orderId));
}

// Threaded from "adds a to-pack item…" into the two tests after it, the
// same way `orders.test.ts` threads its order ids across a describe block.
let shipOlderId = "";
let shipOlderNumber = "";
let shipNewerNumber = "";

describe("getWorkQueue", () => {
  it("is empty once setup is complete and nothing needs the owner's attention", async () => {
    expect(await getWorkQueue()).toEqual([]);
  });

  it("adds a setup item when a checklist entry fails, and drops it once fixed", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    expect(await getWorkQueue()).toEqual([
      expect.objectContaining({
        kind: "setup",
        key: "email",
        title: "Email isn't connected",
        ctaHref: "/admin/settings",
      }),
    ]);

    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "orders@example.com";
    expect(await getWorkQueue()).toEqual([]);
  });

  it("adds a to-pack item counting only ship orders (not pickup), oldest first", async () => {
    const pickup = await createPaidOrder("pickup");
    const older = await createPaidOrder("ship");
    const newer = await createPaidOrder("ship");

    // Backdate explicitly rather than relying on the two calls above
    // landing in different milliseconds — makes "oldest first" a real,
    // non-flaky assertion. Both are still well under the 24h staleness
    // threshold, so neither triggers a stale-order item yet.
    await setPaidAt(older.orderId, new Date(Date.now() - 2 * 60 * 60 * 1000));
    await setPaidAt(newer.orderId, new Date(Date.now() - 1 * 60 * 60 * 1000));
    shipOlderId = older.orderId;
    shipOlderNumber = older.number;
    shipNewerNumber = newer.number;

    const queue = await getWorkQueue();
    const toPack = queue.find((i) => i.kind === "to-pack");
    if (toPack?.kind !== "to-pack") throw new Error("expected a to-pack item");
    expect(toPack.count).toBe(2);
    expect(toPack.orderNumbers).toEqual([shipOlderNumber, shipNewerNumber]);
    expect(toPack.orderNumbers).not.toContain(pickup.number);
    expect(queue.some((i) => i.kind === "stale-order")).toBe(false);
  });

  it("singles out the oldest ship order once it crosses the staleness threshold", async () => {
    await setPaidAt(shipOlderId, new Date(Date.now() - 48 * 60 * 60 * 1000));

    const queue = await getWorkQueue();
    const stale = queue.find((i) => i.kind === "stale-order");
    if (stale?.kind !== "stale-order") throw new Error("expected a stale-order item");
    expect(stale.orderNumber).toBe(shipOlderNumber);
    expect(stale.daysWaiting).toBeGreaterThanOrEqual(2);
    // The general to-pack item still counts it too — the stale item is an
    // addition, not a replacement.
    const toPack = queue.find((i) => i.kind === "to-pack");
    if (toPack?.kind !== "to-pack") throw new Error("expected a to-pack item");
    expect(toPack.count).toBe(2);
  });

  it("adds a held-editions item counting numbers reserved by open checkouts", async () => {
    expect((await getWorkQueue()).some((i) => i.kind === "held-editions")).toBe(false);

    await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });

    const held = (await getWorkQueue()).find((i) => i.kind === "held-editions");
    if (held?.kind !== "held-editions") throw new Error("expected a held-editions item");
    expect(held.count).toBe(1);
  });

  it("orders items setup, then to-pack, then the stale order, then held editions", async () => {
    delete process.env.RESEND_API_KEY;

    const queue = await getWorkQueue();
    expect(queue.map((i) => i.kind)).toEqual(["setup", "to-pack", "stale-order", "held-editions"]);
  });
});
