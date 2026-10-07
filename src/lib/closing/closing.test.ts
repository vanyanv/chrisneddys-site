import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { closingCheckItems, closingChecks } from "@/db/schema";
import { getDb, type Db } from "@/db/client";
import type * as schema from "@/db/schema";
import { ownerHistory, submitCheck } from "./checks";
import {
  addCrew,
  checkCode,
  newCode,
  resolveCrew,
  setActive,
  signCrewToken,
  verifyCrewToken,
} from "./crew";
import { createItem, listItems, moveItem, restoreItem, retireItem, updateItem } from "./items";
import { getOrCreateStore, getStoreByToken, rotateLink } from "./store";

const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));
const STORE = "vannuys";
const IN_WINDOW = new Date("2026-10-07T08:30:00Z"); // 01:30 PDT Wed -> Tuesday night
const TUE = "2026-10-06";

let db: Db;

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-closing";
  db = await getDb();
  await migrate(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder });
});

describe("store and items", () => {
  it("creates the store once with a token and the starter checklist", async () => {
    const a = await getOrCreateStore(db, STORE);
    const b = await getOrCreateStore(db, STORE);
    expect(a.linkToken.length).toBeGreaterThanOrEqual(12);
    expect(b.linkToken).toBe(a.linkToken);
    expect((await getStoreByToken(db, a.linkToken))?.store).toBe(STORE);
    const items = await listItems(db, STORE);
    expect(items).toHaveLength(12);
    expect([...new Set(items.map((i) => i.section))]).toEqual([
      "Kitchen",
      "Front and restrooms",
      "Lock-up",
    ]);
    expect(items.find((i) => i.kind === "temp")?.maxValue).toBe(41);
  });

  it("rotates the link", async () => {
    const before = await getOrCreateStore(db, STORE);
    const after = await rotateLink(db, STORE);
    expect(after.linkToken).not.toBe(before.linkToken);
    expect(await getStoreByToken(db, before.linkToken)).toBeNull();
  });

  it("moves within a section and retires/restores", async () => {
    const items = await listItems(db, STORE);
    const [first, second] = items;
    await moveItem(db, first!.id, "down");
    const moved = await listItems(db, STORE);
    expect(moved[0]!.id).toBe(second!.id);
    expect(moved[1]!.id).toBe(first!.id);
    await moveItem(db, first!.id, "up");

    const extra = await createItem(db, STORE, { section: "Lock-up", label: "Temp item" });
    await retireItem(db, extra.id);
    expect((await listItems(db, STORE)).some((i) => i.id === extra.id)).toBe(false);
    expect(
      (await listItems(db, STORE, { includeRetired: true })).some((i) => i.id === extra.id),
    ).toBe(true);
    await restoreItem(db, extra.id);
    expect((await listItems(db, STORE)).at(-1)!.id).toBe(extra.id);
    await retireItem(db, extra.id);
  });
});

describe("crew", () => {
  it("generates unique 4-digit codes", async () => {
    const people = [];
    for (let i = 0; i < 30; i++) people.push(await addCrew(db, "codes-test", `P${i}`));
    const codes = people.map((p) => p.code);
    expect(new Set(codes).size).toBe(30);
    for (const c of codes) expect(c).toMatch(/^\d{4}$/);
  });

  it("rejects remembered-phone tokens after a new code or turning off", async () => {
    const maria = await addCrew(db, STORE, "Maria");
    const cookie = signCrewToken(maria.id, maria.sessionVersion);
    expect((await resolveCrew(db, STORE, cookie))?.id).toBe(maria.id);
    expect(verifyCrewToken(cookie.slice(0, -2) + "xx")).toBeNull();
    expect(await resolveCrew(db, STORE, undefined)).toBeNull();

    const renewed = (await newCode(db, maria.id))!;
    expect(renewed.code).not.toBe(maria.code);
    expect(await resolveCrew(db, STORE, cookie)).toBeNull();

    const cookie2 = signCrewToken(renewed.id, renewed.sessionVersion);
    expect(await resolveCrew(db, STORE, cookie2)).not.toBeNull();
    const off = (await setActive(db, maria.id, false))!;
    expect(await resolveCrew(db, STORE, cookie2)).toBeNull();
    const on = (await setActive(db, maria.id, true))!;
    expect(on.code).not.toBe(off.code);
    expect(on.sessionVersion).toBeGreaterThan(off.sessionVersion);
  });

  it("locks an IP after 20 wrong codes", async () => {
    const jose = await addCrew(db, STORE, "Jose");
    const now = new Date("2026-10-07T08:00:00Z");
    const wrong = jose.code === "0000" ? "1111" : "0000";
    for (let i = 0; i < 20; i++) {
      expect((await checkCode(db, STORE, wrong, "9.9.9.9", now)).status).toBe("wrong");
    }
    expect((await checkCode(db, STORE, jose.code, "9.9.9.9", now)).status).toBe("locked");
    const other = await checkCode(db, STORE, jose.code, "8.8.8.8", now);
    expect(other.status).toBe("ok");
  });
});

describe("submitCheck and history", () => {
  it("refuses before the window, accepts inside, then reports already", async () => {
    const crew = await addCrew(db, STORE, "Closer");
    const live = await listItems(db, STORE);
    const answers = live.map((i) => ({
      itemId: i.id,
      done: true,
      value: i.kind === "temp" ? "38" : undefined,
    }));
    const base = { store: STORE, crew, answers, lang: "en" };

    const early = await submitCheck(db, { ...base, now: new Date("2026-10-07T07:29:00Z") });
    expect(early).toEqual({ status: "closed", reason: "before" });

    const sent = await submitCheck(db, { ...base, now: IN_WINDOW });
    expect(sent.status).toBe("sent");
    if (sent.status !== "sent") return;
    expect(sent.check.businessDate).toBe(TUE);
    expect(sent.check.items).toHaveLength(live.length);

    const again = await submitCheck(db, { ...base, now: new Date("2026-10-07T08:45:00Z") });
    expect(again.status).toBe("already");
    if (again.status === "already") expect(again.check.id).toBe(sent.check.id);

    const late = await submitCheck(db, { ...base, now: new Date("2026-10-07T09:01:00Z") });
    expect(late.status).toBe("closed");
  });

  it("history keeps the snapshot after renames and retirements", async () => {
    const live = await listItems(db, STORE);
    const target = live[0]!;
    const originalLabel = target.label;
    await updateItem(db, target.id, { label: "Renamed later" });
    const { nights } = await ownerHistory(db, STORE, IN_WINDOW);
    const snap = nights[0]!.check!.items.find((i) => i.itemId === target.id)!;
    expect(snap.label).toBe(originalLabel);
    await updateItem(db, target.id, { label: originalLabel });
  });

  it("only two concurrent submits produce exactly one sent", async () => {
    const crew = await addCrew(db, STORE, "Racer");
    const now = new Date("2026-10-08T08:30:00Z"); // Wednesday night
    const input = { store: STORE, crew, answers: [], lang: "es", now };
    const results = await Promise.all([submitCheck(db, input), submitCheck(db, input)]);
    expect(results.map((r) => r.status).sort()).toEqual(["already", "sent"]);
  });

  it("does not snapshot retired items; missing answers are not done", async () => {
    const crew = await addCrew(db, STORE, "Third");
    const live = await listItems(db, STORE);
    const retired = live[1]!;
    await retireItem(db, retired.id);
    const now = new Date("2026-10-09T08:30:00Z"); // Thursday night
    const res = await submitCheck(db, {
      store: STORE,
      crew,
      answers: [
        { itemId: live[0]!.id, done: true },
        { itemId: "00000000-0000-0000-0000-000000000000", done: true },
      ],
      note: "  all quiet  ",
      lang: "en",
      now,
    });
    expect(res.status).toBe("sent");
    if (res.status !== "sent") return;
    expect(res.check.note).toBe("all quiet");
    expect(res.check.items.some((i) => i.itemId === retired.id)).toBe(false);
    expect(res.check.items.find((i) => i.itemId === live[0]!.id)?.done).toBe(true);
    expect(res.check.items.find((i) => i.itemId === live[2]!.id)?.done).toBe(false);
    await restoreItem(db, retired.id);
  });

  it("ownerHistory reports missed, not-yet, and streaks", async () => {
    const now = new Date("2026-10-09T17:00:00Z"); // Fri 10:00 PDT, night = Fri 10-09
    const { nights, items } = await ownerHistory(db, STORE, now, 5);
    expect(nights.map((n) => n.date)).toEqual([
      "2026-10-09",
      "2026-10-08",
      "2026-10-07",
      "2026-10-06",
      "2026-10-05",
    ]);
    // Tonight: no check yet and window not ended -> "not yet".
    expect(nights[0]).toMatchObject({ check: null, windowEnded: false });
    // 10-07 night: sent by the concurrency test.
    expect(nights[2]!.check).not.toBeNull();
    // 10-08 night: sent by the retired-item test.
    expect(nights[1]!.check).not.toBeNull();
    // 10-05 night: nothing sent, window over -> missed.
    expect(nights[4]).toMatchObject({ check: null, windowEnded: true });

    const first = items[0]!;
    expect(first.sequence).toEqual(["none", "done", "missed", "done", "none"]);
    expect(first.missed).toBe(1);
    expect(first.nightsSeen).toBe(3);
    expect(first.streak).toBe(1);
  });
});

describe("updateItem section moves", () => {
  it("keeps section order when an item changes section", async () => {
    const s = "move-test";
    const mk = (section: string, label: string) => createItem(db, s, { section, label });
    const a = await mk("Kitchen", "A");
    await mk("Kitchen", "B");
    await mk("Front and restrooms", "C");
    const d = await mk("Lock-up", "D");
    const view = async () => (await listItems(db, s)).map((i) => `${i.section}:${i.label}`);

    await updateItem(db, a.id, { section: "Lock-up" });
    expect(await view()).toEqual(["Kitchen:B", "Front and restrooms:C", "Lock-up:D", "Lock-up:A"]);

    await updateItem(db, d.id, { section: "Kitchen" });
    expect(await view()).toEqual(["Kitchen:B", "Kitchen:D", "Front and restrooms:C", "Lock-up:A"]);
    const positions = (await listItems(db, s)).map((i) => i.position);
    expect(positions).toEqual([0, 1, 2, 3]);
  });
});

describe("temperature answers", () => {
  const tempOf = (c: { items: { kind: string; done: boolean; value: string | null }[] }) =>
    c.items.find((i) => i.kind === "temp")!;

  it("saves a done temp without a numeric value as not done", async () => {
    const crew = await addCrew(db, STORE, "Temp1");
    const temp = (await listItems(db, STORE)).find((i) => i.kind === "temp")!;
    const res = await submitCheck(db, {
      store: STORE,
      crew,
      answers: [{ itemId: temp.id, done: true, value: "abc" }],
      lang: "en",
      now: new Date("2026-10-02T08:30:00Z"), // night of 2026-10-01
    });
    expect(res.status).toBe("sent");
    if (res.status !== "sent") return;
    expect(tempOf(res.check)).toMatchObject({ done: false, value: null });
  });

  it("keeps a done temp with a numeric value", async () => {
    const crew = await addCrew(db, STORE, "Temp2");
    const temp = (await listItems(db, STORE)).find((i) => i.kind === "temp")!;
    const res = await submitCheck(db, {
      store: STORE,
      crew,
      answers: [{ itemId: temp.id, done: true, value: " 38 " }],
      lang: "en",
      now: new Date("2026-10-03T08:30:00Z"), // night of 2026-10-02
    });
    expect(res.status).toBe("sent");
    if (res.status !== "sent") return;
    expect(tempOf(res.check)).toMatchObject({ done: true, value: "38" });
  });

  it("history treats a done temp with a non-numeric value as missed", async () => {
    const s = "cellfor-test";
    const item = await createItem(db, s, {
      section: "Kitchen",
      label: "T",
      kind: "temp",
      maxValue: 41,
    });
    const [check] = await db
      .insert(closingChecks)
      .values({ store: s, businessDate: "2026-10-06", crewName: "x" })
      .returning();
    await db.insert(closingCheckItems).values({
      checkId: check!.id,
      itemId: item.id,
      section: "Kitchen",
      label: "T",
      kind: "temp",
      maxValue: 41,
      value: "n/a",
      done: true,
      position: 0,
    });
    const { items } = await ownerHistory(db, s, IN_WINDOW, 1);
    expect(items[0]!.sequence).toEqual(["missed"]);
  });
});
