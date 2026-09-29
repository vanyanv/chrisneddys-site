import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getCateringSettings, saveCateringSettings } from "@/lib/catering/settings";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

describe("getCateringSettings", () => {
  it("creates and returns bare defaults on first read", async () => {
    const settings = await getCateringSettings();
    expect(settings.id).toBe("default");
    expect(settings.orderingOn).toBe(false);
    expect(settings.deliveryFeeCents).toBe(2500);
    expect(settings.rangeMiles).toBe(10);
    expect(settings.replyHours).toBe(24);
    expect(settings.leadHours).toBe(48);
    expect(settings.ownerEmail).toBe("chris@chrisneddys.com");
    expect(settings.daysOff).toEqual([]);
    expect(settings.hours["hollywood"]?.["0"]).toEqual([{ open: "10:00", close: "20:00" }]);
    expect(settings.hours["vannuys"]?.["6"]).toEqual([{ open: "10:00", close: "20:00" }]);
  });

  it("is idempotent: a second read returns the same row, not a new one", async () => {
    const first = await getCateringSettings();
    const second = await getCateringSettings();
    expect(second.id).toBe(first.id);
  });
});

describe("saveCateringSettings", () => {
  it("turns ordering on", async () => {
    const result = await saveCateringSettings({ orderingOn: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.orderingOn).toBe(true);
  });

  it("accepts a valid hours patch", async () => {
    const result = await saveCateringSettings({
      hours: {
        hollywood: { "0": [{ open: "09:00", close: "21:00" }] },
        vannuys: { "0": [{ open: "10:00", close: "20:00" }] },
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a badly formatted time", async () => {
    const result = await saveCateringSettings({
      hours: { hollywood: { "0": [{ open: "9:00", close: "21:00" }] } },
    });
    expect(result).toMatchObject({ ok: false, field: "hours" });
  });

  it("rejects open >= close", async () => {
    const result = await saveCateringSettings({
      hours: { hollywood: { "0": [{ open: "20:00", close: "10:00" }] } },
    });
    expect(result).toMatchObject({ ok: false, field: "hours" });
  });

  it("rejects an out-of-range weekday key", async () => {
    const result = await saveCateringSettings({
      hours: { hollywood: { "7": [{ open: "10:00", close: "20:00" }] } },
    });
    expect(result).toMatchObject({ ok: false, field: "hours" });
  });

  it("accepts a valid day off and rejects a badly formatted date", async () => {
    const ok = await saveCateringSettings({
      daysOff: [{ date: "2026-12-25", store: "all" }],
    });
    expect(ok.ok).toBe(true);

    const bad = await saveCateringSettings({ daysOff: [{ date: "12/25/2026", store: "all" }] });
    expect(bad).toMatchObject({ ok: false, field: "daysOff" });
  });

  it("rejects a delivery fee outside 0..20000 cents", async () => {
    const tooHigh = await saveCateringSettings({ deliveryFeeCents: 20_001 });
    expect(tooHigh).toMatchObject({ ok: false, field: "deliveryFeeCents" });

    const negative = await saveCateringSettings({ deliveryFeeCents: -1 });
    expect(negative).toMatchObject({ ok: false, field: "deliveryFeeCents" });

    const ok = await saveCateringSettings({ deliveryFeeCents: 3000 });
    expect(ok.ok).toBe(true);
  });

  it("rejects a delivery range outside 1..50 miles", async () => {
    const tooLow = await saveCateringSettings({ rangeMiles: 0 });
    expect(tooLow).toMatchObject({ ok: false, field: "rangeMiles" });

    const tooHigh = await saveCateringSettings({ rangeMiles: 51 });
    expect(tooHigh).toMatchObject({ ok: false, field: "rangeMiles" });

    const ok = await saveCateringSettings({ rangeMiles: 15 });
    expect(ok.ok).toBe(true);
  });

  it("rejects a non-positive reply/lead setting", async () => {
    const result = await saveCateringSettings({ replyHours: 0 });
    expect(result).toMatchObject({ ok: false, field: "replyHours" });
  });

  it("accepts any positive notice: there is no separate big-order notice to conflict with", async () => {
    const result = await saveCateringSettings({ leadHours: 80 });
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects a malformed owner email", async () => {
    const result = await saveCateringSettings({ ownerEmail: "not-an-email" });
    expect(result).toMatchObject({ ok: false, field: "ownerEmail" });
  });

  it("persists across reads", async () => {
    const save = await saveCateringSettings({ ownerEmail: "owner@chrisneddys.com" });
    expect(save.ok).toBe(true);
    const settings = await getCateringSettings();
    expect(settings.ownerEmail).toBe("owner@chrisneddys.com");
  });
});
