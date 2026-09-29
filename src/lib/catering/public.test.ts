import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { saveCateringSettings } from "./settings";
import { getPublicCateringConfig } from "./public";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

describe("getPublicCateringConfig", () => {
  it("shapes settings and store details for a client component, no ordering-off leaks", async () => {
    const config = await getPublicCateringConfig();
    expect(config.orderingOn).toBe(false);
    expect(config.stores).toHaveLength(2);

    const hollywood = config.stores.find((s) => s.id === "hollywood");
    expect(hollywood).toMatchObject({ name: "Hollywood", city: "Los Angeles", zip: "90028" });
    expect(hollywood?.address).toBeTruthy();
    expect(hollywood?.phone).toBeTruthy();

    const vannuys = config.stores.find((s) => s.id === "vannuys");
    expect(vannuys).toMatchObject({ name: "Van Nuys", zip: "91405" });

    expect(config.deliveryFeeCents).toBe(2500);
    expect(config.rangeMiles).toBe(10);
    expect(config.replyHours).toBe(24);
    expect(config.leadHours).toBe(48);
    expect(config).not.toHaveProperty("bigLeadHours");
    expect(config).not.toHaveProperty("bigHeadcount");
    expect(config.hours.hollywood[0]).toEqual({
      closed: false,
      windows: [{ open: "10:00", close: "20:00" }],
    });
    expect(config.daysOff).toEqual({ all: [], byStore: {} });
  });

  it("reflects ordering-on and a saved day off", async () => {
    const saved = await saveCateringSettings({
      orderingOn: true,
      daysOff: [
        { date: "2026-12-25", store: "hollywood" },
        { date: "2026-12-25", store: "vannuys" },
      ],
    });
    expect(saved.ok).toBe(true);

    const config = await getPublicCateringConfig();
    expect(config.orderingOn).toBe(true);
    expect(config.daysOff.all).toEqual(["2026-12-25"]);
  });
});
