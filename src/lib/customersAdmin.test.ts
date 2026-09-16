/**
 * Covers `listCustomersForAdmin`/`getCustomerForAdmin` — the read layer
 * behind "Everyone who's bought" (issue #36 phase 7). A customer here is a
 * projection over `orders` grouped by normalized email, not a stored row
 * (see the doc comment in `customersAdmin.ts`), so this file exists
 * specifically to prove:
 *
 * 1. A guest whose order never reached payment (no email yet) is never
 *    counted as a customer — `createPendingOrder` leaves `email` null.
 * 2. Two orders under the very same (but differently-cased/whitespaced)
 *    email fold into one customer, keyed on the normalized form.
 * 3. Two orders under genuinely different emails for "the same person"
 *    stay two separate customers — nothing here merges identities.
 * 4. Money, order count and the refunded count are real sums over that
 *    person's actual orders, not approximations.
 * 5. Numbered editions a customer bought surface as "owned numbers" and a
 *    run board, reusing `getRunForAdmin`'s own join.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { createPendingOrder, markPaid, markRefunded } from "@/lib/orders";
import { getCustomerForAdmin, listCustomersForAdmin, normalizeEmail } from "@/lib/customersAdmin";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

async function payFoamTrucker(
  email: string,
  name: string,
  extra: Partial<Parameters<typeof markPaid>[0]> = {},
): Promise<string> {
  const reservation = await createPendingOrder({
    items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
    fulfilment: "ship",
  });
  if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

  await markPaid({
    orderId: reservation.orderId,
    paymentIntentId: `pi_test_${reservation.number}`,
    email,
    name,
    amounts: { subtotal: 4800, shipping: 600, tax: 0, total: 5400 },
    ...extra,
  });

  return reservation.orderId;
}

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Anh@Vuong.Studio  ")).toBe("anh@vuong.studio");
  });
});

describe("listCustomersForAdmin / getCustomerForAdmin", () => {
  it("never counts a guest mid-checkout — no email, no customer", async () => {
    const reservation = await createPendingOrder({
      items: [{ slug: FOAM_TRUCKER_SLUG, quantity: 1 }],
      fulfilment: "ship",
    });
    if ("code" in reservation) throw new Error(`expected a reservation, got ${reservation.code}`);

    // Never paid — createPendingOrder leaves email/name null, and it stays
    // that way. Nothing about this order should surface as a customer.
    const before = await listCustomersForAdmin();
    const keys = new Set(before.map((c) => c.key));
    expect(keys.has("")).toBe(false);
    expect(before.every((c) => c.email.length > 0)).toBe(true);
  });

  it("folds two orders under the same email (different case/whitespace) into one customer", async () => {
    await payFoamTrucker("Anh@Vuong.Studio", "Anh Vuong");
    await payFoamTrucker("  anh@vuong.studio ", "Anh Vuong");

    const customer = await getCustomerForAdmin("anh@vuong.studio");
    expect(customer).toBeDefined();
    expect(customer?.orderCount).toBe(2);
    expect(customer?.totalSpentCents).toBe(5400 * 2);
    expect(customer?.name).toBe("Anh Vuong");

    // Looking it up by a differently-cased/whitespaced key finds the same
    // customer — the route normalizes before querying.
    const same = await getCustomerForAdmin("  ANH@VUONG.STUDIO  ");
    expect(same?.key).toBe(customer?.key);
    expect(same?.orderCount).toBe(2);

    const listed = await listCustomersForAdmin();
    const row = listed.find((c) => c.key === "anh@vuong.studio");
    expect(row).toBeDefined();
    expect(row?.orderCount).toBe(2);
  });

  it("two different emails for the same real person stay two separate customers", async () => {
    // "Sam" checks out once with a work email and once with a personal one.
    // Nothing in this module has any way to know they're the same person —
    // that's the identity-key limitation the module doc states plainly.
    await payFoamTrucker("sam@work.example", "Sam Rivera");
    await payFoamTrucker("sam.personal@example.com", "Sam Rivera");

    const work = await getCustomerForAdmin("sam@work.example");
    const personal = await getCustomerForAdmin("sam.personal@example.com");
    expect(work).toBeDefined();
    expect(personal).toBeDefined();
    expect(work?.key).not.toBe(personal?.key);
    expect(work?.orderCount).toBe(1);
    expect(personal?.orderCount).toBe(1);
  });

  it("counts a refund honestly, and still totals the money that moved", async () => {
    const orderId = await payFoamTrucker("refunder@example.com", "Refund Case");
    const result = await markRefunded(orderId, {});
    expect(result.ok).toBe(true);

    const customer = await getCustomerForAdmin("refunder@example.com");
    expect(customer).toBeDefined();
    expect(customer?.orderCount).toBe(1);
    expect(customer?.refundedCount).toBe(1);
    expect(customer?.totalSpentCents).toBe(5400);
  });

  it("surfaces the numbered editions a customer bought, with a run board", async () => {
    const orderId = await payFoamTrucker("numbered@example.com", "Numbers Owner");

    const customer = await getCustomerForAdmin("numbered@example.com");
    expect(customer).toBeDefined();
    expect(customer?.ownedNumbers.length).toBe(1);
    expect(customer?.ownedNumbers[0]?.number).toBeGreaterThan(0);

    expect(customer?.runs.length).toBe(1);
    const run = customer!.runs[0]!;
    const ownedNumber = customer!.ownedNumbers[0]!.number;
    const cell = run.numbers.find((n) => n.number === ownedNumber);
    expect(cell?.status).toBe("sold");
    expect(cell?.order?.orderId).toBe(orderId);
  });

  it("returns undefined for an email nobody has ever paid with", async () => {
    expect(await getCustomerForAdmin("nobody@example.com")).toBeUndefined();
  });
});
