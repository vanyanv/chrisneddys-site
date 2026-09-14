/**
 * Covers `quoteCart`'s defensive duplicate-slug merge — without it, a cart
 * that repeats the same slug across two line items could slip past the
 * per-product `perOrderLimit` (each line individually within the limit, the
 * sum across lines over it). See also the checkout route's own body-parsing
 * merge (`src/app/api/checkout/route.test.ts`), which is the primary
 * defense; this is the same guard applied a second time, inside `quoteCart`
 * itself.
 */
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { quoteCart } from "@/lib/orders";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
// Seeded with `perOrderLimit` 6 (the schema default) — see `src/db/seed.ts`.
const FOAM_TRUCKER_SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

describe("quoteCart — duplicate-slug merge defends the per-order limit", () => {
  it("sums two lines of 6 for a product with a limit of 6 into one over-limit line", async () => {
    const quote = await quoteCart(
      [
        { slug: FOAM_TRUCKER_SLUG, quantity: 6 },
        { slug: FOAM_TRUCKER_SLUG, quantity: 6 },
      ],
      "pickup",
    );

    expect("code" in quote && quote.code).toBe("over_limit");
  });

  it("still accepts one line at exactly the limit", async () => {
    const quote = await quoteCart([{ slug: FOAM_TRUCKER_SLUG, quantity: 6 }], "pickup");
    expect("code" in quote).toBe(false);
    if ("code" in quote) throw new Error("unreachable");
    expect(quote.lines[0]?.quantity).toBe(6);
  });

  it("merges three small duplicate lines into one line with the summed quantity", async () => {
    const quote = await quoteCart(
      [
        { slug: FOAM_TRUCKER_SLUG, quantity: 1 },
        { slug: FOAM_TRUCKER_SLUG, quantity: 1 },
        { slug: FOAM_TRUCKER_SLUG, quantity: 1 },
      ],
      "pickup",
    );
    expect("code" in quote).toBe(false);
    if ("code" in quote) throw new Error("unreachable");
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]?.quantity).toBe(3);
  });
});
