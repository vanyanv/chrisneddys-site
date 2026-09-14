/**
 * Covers the one thing `getDb()` absolutely must provide for
 * `src/lib/orders.ts` to be safe under concurrency: a client whose
 * `.transaction()` actually runs its callback inside a real Postgres
 * transaction (`BEGIN`/`COMMIT`/`ROLLBACK`), not the neon-http driver's
 * "No transactions support in neon-http driver" stub.
 *
 * This test always runs against the Vitest/PGlite branch of `createDb()`
 * (no `DATABASE_URL` here) — PGlite is a real embedded Postgres, so
 * `.transaction()` on it exercises the same `PgTransaction` machinery a real
 * connection-based driver (PGlite here, `Pool`/neon-serverless in
 * production) does; neon-http is the one driver in this codebase whose
 * `.transaction()` cannot work at all, and swapping `client.ts` to it is
 * exactly the regression this guards against.
 */
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { getDb } from "./client.ts";
import * as schema from "./schema.ts";
import { storeSettings } from "./schema.ts";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

describe("getDb()", () => {
  it("returns a client whose .transaction() commits real writes", async () => {
    const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
    await migrate(db, { migrationsFolder });

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(storeSettings)
        .values({
          id: "txn-test",
          storeName: "Transaction Test",
          supportEmail: "txn@example.com",
        })
        .onConflictDoNothing({ target: storeSettings.id })
        .returning({ id: storeSettings.id });
      return row?.id;
    });

    expect(result).toBe("txn-test");

    const persisted = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.id, "txn-test"),
    });
    expect(persisted?.storeName).toBe("Transaction Test");
  });

  it("rolls back every write when the transaction callback throws", async () => {
    const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(storeSettings).values({
          id: "txn-rollback-test",
          storeName: "Should not persist",
          supportEmail: "rollback@example.com",
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const persisted = await db.query.storeSettings.findFirst({
      where: eq(storeSettings.id, "txn-rollback-test"),
    });
    expect(persisted).toBeUndefined();
  });
});
