/**
 * Proves `markRefundedAction` refuses an unauthenticated caller — the
 * highest-consequence action in this file (it reverses a real payment's
 * record). The check itself lives two layers down (`requireOwner()` inside
 * `markRefunded`, `src/lib/ordersAdmin.ts`) as well as at the top of this
 * action (added so this file matches the pattern every action in
 * `src/app/(admin)/admin/products/actions.ts` follows); this test doesn't
 * care which layer catches it, only that an unauthenticated call never
 * reaches the database write.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { createPendingOrder, getOrder, markPaid } from "@/lib/orders";

// `markRefundedAction` -> `requireOwner()` (`@/lib/auth`) reads the session
// cookie through `next/headers`, which throws outside a real Next.js
// request — see the note in `src/lib/auth.test.ts`. `server-only` throws
// the same way for every module in this chain that carries it (`@/lib/auth`,
// `@/lib/ordersAdmin`, `@/lib/orders`).
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { markRefundedAction } = await import("./actions");

const migrationsFolder = fileURLToPath(new URL("../../../../../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

describe("markRefundedAction", () => {
  it("refuses an unauthenticated caller and leaves the order untouched", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

    await markPaid({
      orderId: reservation.orderId,
      paymentIntentId: `pi_test_${reservation.number}`,
      email: "buyer@example.com",
      name: "Test Buyer",
      amounts: { subtotal: 4800, shipping: 600, tax: 0, total: 5400 },
    });

    const formData = new FormData();
    formData.set("orderId", reservation.orderId);

    // With no session cookie (mocked above), Better Auth's `getSession`
    // finds nothing and `requireOwner()` redirects to sign-in — Next.js
    // implements that as a thrown error carrying a `NEXT_REDIRECT` digest,
    // not a normal return value — so the action must reject rather than
    // resolve with `{}`/`{ error }`.
    await expect(markRefundedAction(undefined, formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    // And, critically, the order was never touched.
    const order = await getOrder(reservation.orderId);
    expect(order?.status).toBe("paid");
  });
});
