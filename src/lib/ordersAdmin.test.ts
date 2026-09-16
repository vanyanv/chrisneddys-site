/**
 * Covers `getOrderForAdmin`'s read-side projection directly — unlike the
 * desk's mutations (`setFulfilment`, `markReadyForPickup`, ...), it never
 * calls `requireOwner()`, so it's safe to exercise outside a real request
 * (see the note in `src/lib/orders.admin-flow.test.ts`).
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { createPendingOrder, markPaid } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/ordersAdmin";

// `server-only` throws when a module carrying it is resolved outside a real
// Next.js server build — see the note in `src/app/api/checkout/route.test.ts`.
vi.mock("server-only", () => ({}));

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

async function paidOrderId(): Promise<string> {
  const pending = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "pickup",
  });
  if ("code" in pending) throw new Error(`expected a pending order, got ${pending.code}`);
  await markPaid({
    orderId: pending.orderId,
    paymentIntentId: `pi_${pending.orderId}`,
    email: "buyer@example.com",
    name: "Buyer Person",
    shipTo: null,
    amounts: { subtotal: 4800, shipping: 0, tax: 0, total: 4800 },
  });
  return pending.orderId;
}

describe("getOrderForAdmin", () => {
  it("projects the edition size and the variant's own label onto each item", async () => {
    const orderId = await paidOrderId();
    const order = await getOrderForAdmin(orderId);
    if (!order) throw new Error("expected the paid order to exist");

    expect(order.items).toHaveLength(1);
    const [item] = order.items;
    expect(item?.editionNumber).toEqual(expect.any(Number));
    expect(item?.editionSize).toBe(50);
    expect(item?.variantLabel).toBe("One size");
    // The internal SKU is still there for the desk's own detail page, but
    // it's no longer the only customer-meaningful fact projected.
    expect(item?.sku).toBeTruthy();
  });

  it("returns undefined for an id that doesn't exist", async () => {
    const order = await getOrderForAdmin("00000000-0000-0000-0000-000000000000");
    expect(order).toBeUndefined();
  });
});
