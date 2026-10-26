/**
 * The internal shop API end to end: signed requests go straight into the
 * route handlers (no HTTP server), against a migrated + seeded PGlite
 * database, the same pattern as `src/app/api/checkout/route.test.ts`.
 */
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { createDraft, getProductForAdmin, setInventory } from "@/lib/catalogAdmin";
import { signInternalRequest } from "@/lib/internalApi";
import { createPendingOrder, getOrder, getStoreSettings, markPaid } from "@/lib/orders";

vi.mock("server-only", () => ({}));

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));
const SECRET = "test-secret-test-secret-test-secret-0123";
const SLUG = "foam-trucker-blue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

const { GET: summaryGET } = await import("./summary/route");
const { GET: ordersGET } = await import("./orders/route");
const { GET: orderGET } = await import("./orders/[id]/route");
const { POST: shipPOST } = await import("./orders/[id]/ship/route");
const { POST: readyPOST } = await import("./orders/[id]/ready/route");
const { POST: pickedUpPOST } = await import("./orders/[id]/picked-up/route");
const { POST: refundPOST } = await import("./orders/[id]/refund/route");
const { GET: productsGET, POST: productsPOST } = await import("./products/route");
const { GET: productGET } = await import("./products/[id]/route");
const { POST: statusPOST } = await import("./products/[id]/status/route");
const { POST: inventoryPOST } = await import("./products/[id]/inventory/route");
const { POST: fieldsPOST } = await import("./products/[id]/fields/route");
const { GET: customersGET } = await import("./customers/route");
const { GET: customerGET } = await import("./customers/[key]/route");
const { GET: settingsGET, POST: settingsPOST } = await import("./settings/route");

/** Calls `handler` with a request signed the way the dashboard must sign it. */
async function call(
  handler: unknown,
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; params?: Record<string, string>; sign?: boolean; now?: number } = {},
): Promise<{ status: number; json: Json; headers: Headers }> {
  const rawBody = options.body === undefined ? "" : JSON.stringify(options.body);
  const headers = new Headers();
  if (options.sign !== false) {
    const { timestamp, signature } = signInternalRequest(
      SECRET,
      method,
      path,
      rawBody,
      options.now ?? Date.now(),
    );
    headers.set("x-shop-timestamp", timestamp);
    headers.set("x-shop-signature", signature);
  }
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : rawBody,
  });
  const response = await (handler as Handler)(request, {
    params: Promise.resolve(options.params ?? {}) as Promise<never>,
  });
  return { status: response.status, json: await response.json(), headers: response.headers };
}

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

beforeEach(() => {
  vi.stubEnv("SHOP_INTERNAL_API_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function paidOrder(
  fulfilment: "ship" | "pickup",
  email = "buyer@example.com",
  totalCents = 5400,
): Promise<string> {
  const pending = await createPendingOrder({ items: [{ slug: SLUG, quantity: 1 }], fulfilment });
  if ("code" in pending) throw new Error(`expected a reservation, got ${pending.code}`);
  await markPaid({
    orderId: pending.orderId,
    paymentIntentId: `pi_${pending.orderId}`,
    email,
    name: "Test Buyer",
    shipTo: null,
    amounts: { subtotal: totalCents, shipping: 0, tax: 0, total: totalCents },
  });
  return pending.orderId;
}

const laDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

describe("auth", () => {
  it("503s every route when the secret is unset or too short", async () => {
    vi.stubEnv("SHOP_INTERNAL_API_SECRET", "");
    let res = await call(summaryGET, "GET", "/api/internal/shop/summary");
    expect(res.status).toBe(503);
    expect(res.json).toEqual({ ok: false, error: "Internal API not configured" });

    vi.stubEnv("SHOP_INTERNAL_API_SECRET", "short-secret");
    res = await call(settingsPOST, "POST", "/api/internal/shop/settings", { body: {} });
    expect(res.status).toBe(503);
  });

  it("401s with missing headers, a stale timestamp or a bad signature", async () => {
    const path = "/api/internal/shop/summary";
    expect((await call(summaryGET, "GET", path, { sign: false })).status).toBe(401);

    const stale = await call(summaryGET, "GET", path, { now: Date.now() - 6 * 60 * 1000 });
    expect(stale.status).toBe(401);
    expect(stale.json).toEqual({ ok: false, error: "Unauthorized" });
    const future = await call(summaryGET, "GET", path, { now: Date.now() + 6 * 60 * 1000 });
    expect(future.status).toBe(401);

    const { timestamp } = signInternalRequest(SECRET, "GET", path, "", Date.now());
    for (const signature of [
      "0".repeat(64),
      "abc",
      signInternalRequest("x".repeat(40), "GET", path, "", Number(timestamp)).signature,
    ]) {
      const res = await summaryGET(
        new Request(`http://localhost${path}`, {
          headers: { "x-shop-timestamp": timestamp, "x-shop-signature": signature },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
    }
  });

  it("binds the signature to method, path, query and body", async () => {
    const path = "/api/internal/shop/orders?filter=open";
    const { timestamp, signature } = signInternalRequest(SECRET, "GET", path, "", Date.now());
    const headers = { "x-shop-timestamp": timestamp, "x-shop-signature": signature };
    const params = { params: Promise.resolve({}) };
    const ok = await ordersGET(new Request(`http://localhost${path}`, { headers }), params);
    expect(ok.status).toBe(200);
    const otherQuery = await ordersGET(
      new Request("http://localhost/api/internal/shop/orders?filter=all", { headers }),
      params,
    );
    expect(otherQuery.status).toBe(401);

    const tampered = await call(settingsPOST, "POST", "/api/internal/shop/settings", {
      body: { shopPaused: false },
    });
    expect(tampered.status).toBe(200);
    const { timestamp: t2, signature: s2 } = signInternalRequest(
      SECRET,
      "POST",
      "/api/internal/shop/settings",
      JSON.stringify({ shopPaused: false }),
      Date.now(),
    );
    const swapped = await settingsPOST(
      new Request("http://localhost/api/internal/shop/settings", {
        method: "POST",
        headers: { "x-shop-timestamp": t2, "x-shop-signature": s2 },
        body: JSON.stringify({ shopPaused: true }),
      }),
      params,
    );
    expect(swapped.status).toBe(401);
    expect((await getStoreSettings()).shopPaused).toBe(false);
  });

  it("passes a good signature and answers private, no-store", async () => {
    const res = await call(customersGET, "GET", "/api/internal/shop/customers");
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const denied = await call(customersGET, "GET", "/api/internal/shop/customers", { sign: false });
    expect(denied.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("summary", () => {
  it("counts the desk and builds a 30-day Los Angeles series with zeros", async () => {
    const path = "/api/internal/shop/summary";
    const before = (await call(summaryGET, "GET", path)).json;
    expect(before.sales.days).toHaveLength(30);

    const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
    const now = new Date();
    const lateShip = await paidOrder("ship", "a@example.com", 1000);
    const freshShip = await paidOrder("ship", "b@example.com", 2000);
    const bag = await paidOrder("pickup", "c@example.com", 3000);
    const ready = await paidOrder("pickup", "d@example.com", 4000);
    const shipped = await paidOrder("ship", "e@example.com", 5000);
    const old = await paidOrder("ship", "f@example.com", 6000);
    const refunded = await paidOrder("ship", "g@example.com", 7000);

    const hours = (h: number) => new Date(now.getTime() - h * 3600_000);
    const set = (id: string, values: Partial<typeof schema.orders.$inferInsert>) =>
      db.update(schema.orders).set(values).where(eq(schema.orders.id, id));
    await set(lateShip, { paidAt: hours(30) });
    await set(ready, { status: "ready_for_pickup" });
    await set(shipped, { status: "fulfilled", fulfilledAt: hours(2) });
    // Shipped long ago and paid outside the window: counts nowhere.
    await set(old, { status: "fulfilled", fulfilledAt: hours(24 * 20), paidAt: hours(24 * 45) });
    await set(refunded, { status: "refunded", refundedAt: hours(1) });
    void freshShip;
    void bag;

    const after = (await call(summaryGET, "GET", path)).json;
    const delta = (k: string) => after.counts[k] - before.counts[k];
    expect(delta("toShip")).toBe(2); // lateShip + freshShip
    expect(delta("lateToShip")).toBe(1);
    expect(delta("toBag")).toBe(1);
    expect(delta("readyForPickup")).toBe(1);
    expect(delta("shippedLast7")).toBe(1);
    expect(delta("pickedUpLast7")).toBe(0);

    // Oldest first, ends today (LA), consecutive, every day present.
    const dates: string[] = after.sales.days.map((d: { date: string }) => d.date);
    expect(dates[29]).toBe(laDay(now));
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(30);
    const zeros = after.sales.days.filter((d: { orders: number }) => d.orders === 0);
    expect(zeros.length).toBeGreaterThan(0);

    const today = laDay(now);
    const bucket = (s: Json, date: string) => s.sales.days.find((d: Json) => d.date === date);
    const lateDay = laDay(hours(30));
    // Paid 30h ago lands on its own LA day; the six others were paid just now
    // (the old one 45 days back, outside 30 days).
    const paidTodayCents = 2000 + 3000 + 4000 + 5000 + 7000;
    const todayDelta = bucket(after, today).paidCents - bucket(before, today).paidCents;
    const lateDelta = bucket(after, lateDay).paidCents - bucket(before, lateDay).paidCents;
    if (lateDay === today) {
      expect(todayDelta).toBe(paidTodayCents + 1000);
    } else {
      expect(todayDelta).toBe(paidTodayCents);
      expect(lateDelta).toBe(1000);
    }
    const refundDay = laDay(hours(1));
    expect(bucket(after, refundDay).refundedCents - bucket(before, refundDay).refundedCents).toBe(
      7000,
    );
    expect(after.sales.orders - before.sales.orders).toBe(6);
    expect(after.sales.paidCents - before.sales.paidCents).toBe(paidTodayCents + 1000);
    expect(after.sales.refundedCents - before.sales.refundedCents).toBe(7000);
    expect(after.settings).toEqual({
      pickupEnabled: expect.any(Boolean),
      pickupAddress: expect.any(String),
      shopPaused: false,
      pauseNote: null,
    });
    expect(typeof after.generatedAt).toBe("string");
  });

  it("honours ?days and rejects a bad one", async () => {
    const seven = await call(summaryGET, "GET", "/api/internal/shop/summary?days=7");
    expect(seven.json.sales.days).toHaveLength(7);
    for (const bad of ["0", "91", "abc", "1.5"]) {
      const res = await call(summaryGET, "GET", `/api/internal/shop/summary?days=${bad}`);
      expect(res.status).toBe(400);
    }
  });

  it("lists published products with 3 or fewer left", async () => {
    const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
    const { id, slug } = await createDraft("Low Stock Tee");
    await setInventory(id, "quantity", 2);
    await db.update(schema.products).set({ status: "published" }).where(eq(schema.products.id, id));
    const { id: draftId } = await createDraft("Hidden Low Tee");
    await setInventory(draftId, "quantity", 1);

    const res = await call(summaryGET, "GET", "/api/internal/shop/summary");
    expect(res.json.lowStock).toContainEqual({
      productId: id,
      name: expect.any(String),
      slug,
      remaining: 2,
      mode: "quantity",
    });
    expect(res.json.lowStock.map((p: { productId: string }) => p.productId)).not.toContain(draftId);
  });
});

describe("orders", () => {
  it("lists with filters (including open) and a cursor, and reads one", async () => {
    const id = await paidOrder("ship");
    const open = await call(ordersGET, "GET", "/api/internal/shop/orders?filter=open");
    expect(open.status).toBe(200);
    expect(open.json.rows.map((r: { id: string }) => r.id)).toContain(id);
    expect(open.json).toHaveProperty("nextCursor");

    const bad = await call(ordersGET, "GET", "/api/internal/shop/orders?filter=nope");
    expect(bad.status).toBe(400);

    const one = await call(orderGET, "GET", `/api/internal/shop/orders/${id}`, { params: { id } });
    expect(one.json.order.id).toBe(id);
    const missing = await call(orderGET, "GET", "/api/internal/shop/orders/nope", {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(missing.status).toBe(404);
  });

  it("ships a paid order, then refuses to ship it again", async () => {
    const id = await paidOrder("ship");
    const path = `/api/internal/shop/orders/${id}/ship`;
    const noTracking = await call(shipPOST, "POST", path, {
      params: { id },
      body: { carrier: "UPS", trackingNumber: " " },
    });
    expect(noTracking.status).toBe(400);
    const ok = await call(shipPOST, "POST", path, {
      params: { id },
      body: { carrier: "UPS", trackingNumber: "1Z999" },
    });
    expect(ok).toMatchObject({ status: 200, json: { ok: true } });
    const order = await getOrder(id);
    expect(order).toMatchObject({ status: "fulfilled", carrier: "UPS", trackingNumber: "1Z999" });

    const again = await call(shipPOST, "POST", path, {
      params: { id },
      body: { carrier: "UPS", trackingNumber: "1Z999" },
    });
    expect(again.status).toBe(400);
    expect(again.json.ok).toBe(false);
    const malformed = await call(shipPOST, "POST", path, { params: { id }, body: { carrier: 1 } });
    expect(malformed.status).toBe(400);
  });

  it("moves a pickup order paid -> ready -> picked up, and refuses the illegal hops", async () => {
    const id = await paidOrder("pickup");
    const p = (leaf: string) => `/api/internal/shop/orders/${id}/${leaf}`;
    expect((await call(readyPOST, "POST", p("ready"), { params: { id } })).status).toBe(200);
    expect((await getOrder(id))?.status).toBe("ready_for_pickup");
    const readyAgain = await call(readyPOST, "POST", p("ready"), { params: { id } });
    expect(readyAgain.status).toBe(400);
    expect((await call(pickedUpPOST, "POST", p("picked-up"), { params: { id } })).status).toBe(200);
    expect((await getOrder(id))?.status).toBe("picked_up");
    const pickedAgain = await call(pickedUpPOST, "POST", p("picked-up"), { params: { id } });
    expect(pickedAgain).toMatchObject({ status: 400, json: { ok: false } });

    const gone = await call(readyPOST, "POST", "/api/internal/shop/orders/x/ready", {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(gone.status).toBe(404);
  });

  it("won't ship a pickup order or bag a ship order", async () => {
    const pickup = await paidOrder("pickup");
    const shipped = await call(shipPOST, "POST", `/api/internal/shop/orders/${pickup}/ship`, {
      params: { id: pickup },
      body: { carrier: "USPS", trackingNumber: "9400100000000000000000" },
    });
    expect(shipped).toMatchObject({
      status: 400,
      json: { ok: false, error: "This is a pickup order. Mark it ready for pickup instead." },
    });
    const ship = await paidOrder("ship");
    for (const [handler, leaf] of [
      [readyPOST, "ready"],
      [pickedUpPOST, "picked-up"],
    ] as const) {
      const r = await call(handler, "POST", `/api/internal/shop/orders/${ship}/${leaf}`, {
        params: { id: ship },
      });
      expect(r).toMatchObject({
        status: 400,
        json: { error: "This order ships. Mark it shipped instead." },
      });
    }
    expect((await getOrder(pickup))?.status).toBe("paid");
    expect((await getOrder(ship))?.status).toBe("paid");
  });

  it("refunds with a reason, files it as a note, and refuses a second refund", async () => {
    const id = await paidOrder("ship");
    const path = `/api/internal/shop/orders/${id}/refund`;
    const ok = await call(refundPOST, "POST", path, {
      params: { id },
      body: { reason: "Wrong size", release: false },
    });
    expect(ok).toMatchObject({ status: 200, json: { ok: true } });
    const order = await getOrder(id);
    expect(order?.status).toBe("refunded");
    expect(order?.notes).toContain("Refund reason: Wrong size");

    const again = await call(refundPOST, "POST", path, { params: { id }, body: {} });
    expect(again.status).toBe(400);
    const badBody = await call(refundPOST, "POST", path, {
      params: { id },
      body: { release: "yes" },
    });
    expect(badBody.status).toBe(400);

    // An empty body is fine for a refund (reason and release are optional).
    const second = await paidOrder("ship");
    const empty = await call(refundPOST, "POST", `/api/internal/shop/orders/${second}/refund`, {
      params: { id: second },
    });
    expect(empty.status).toBe(200);
  });
});

describe("products", () => {
  it("creates a draft, lists it, and reads it", async () => {
    const created = await call(productsPOST, "POST", "/api/internal/shop/products", {
      body: { name: "Internal Tee" },
    });
    expect(created.json).toEqual({ ok: true, id: expect.any(String), slug: "internal-tee" });
    const noName = await call(productsPOST, "POST", "/api/internal/shop/products", { body: {} });
    expect(noName.status).toBe(400);

    const list = await call(productsGET, "GET", "/api/internal/shop/products");
    expect(list.json.products.map((p: { id: string }) => p.id)).toContain(created.json.id);
    const one = await call(productGET, "GET", `/api/internal/shop/products/${created.json.id}`, {
      params: { id: created.json.id },
    });
    expect(one.json.product.slug).toBe("internal-tee");
    const missing = await call(productGET, "GET", "/api/internal/shop/products/x", {
      params: { id: "00000000-0000-0000-0000-000000000000" },
    });
    expect(missing.status).toBe(404);
  });

  it("sets status with the admin's publish checks, and lists archived", async () => {
    const { id } = (
      await call(productsPOST, "POST", "/api/internal/shop/products", {
        body: { name: "Status Tee" },
      })
    ).json;
    const path = `/api/internal/shop/products/${id}/status`;
    const publish = await call(statusPOST, "POST", path, {
      params: { id },
      body: { status: "published" },
    });
    expect(publish.status).toBe(400); // no price, no run, no photo yet
    expect(publish.json.ok).toBe(false);

    const archive = await call(statusPOST, "POST", path, {
      params: { id },
      body: { status: "archived" },
    });
    expect(archive.json).toEqual({ ok: true });
    const archived = await call(productsGET, "GET", "/api/internal/shop/products?archived=1");
    expect(archived.json.products.map((p: { id: string }) => p.id)).toContain(id);
    const restore = await call(statusPOST, "POST", path, {
      params: { id },
      body: { status: "draft" },
    });
    expect(restore.json.ok).toBe(true);

    const badStatus = await call(statusPOST, "POST", path, {
      params: { id },
      body: { status: "live" },
    });
    expect(badStatus.status).toBe(400);
    const missing = await call(statusPOST, "POST", path, {
      params: { id: "00000000-0000-0000-0000-000000000000" },
      body: { status: "draft" },
    });
    expect(missing.status).toBe(404);
  });

  it("sets the on-hand count for quantity products only", async () => {
    const { id } = await createDraft("Count Tee");
    const path = `/api/internal/shop/products/${id}/inventory`;
    const untracked = await call(inventoryPOST, "POST", path, {
      params: { id },
      body: { count: 5 },
    });
    expect(untracked.status).toBe(400);

    await setInventory(id, "quantity", 1);
    const ok = await call(inventoryPOST, "POST", path, { params: { id }, body: { count: 12 } });
    expect(ok.json).toEqual({ ok: true });
    expect((await getProductForAdmin(id))?.inventory).toEqual({ mode: "quantity", quantity: 12 });
    for (const count of [-1, 1.5, "3", undefined]) {
      const bad = await call(inventoryPOST, "POST", path, { params: { id }, body: { count } });
      expect(bad.status).toBe(400);
    }

    const edition = await getProductForAdmin(
      (await (await getDb()).query.products.findFirst({ where: eq(schema.products.slug, SLUG) }))!
        .id,
    );
    const editionRes = await call(
      inventoryPOST,
      "POST",
      `/api/internal/shop/products/${edition!.id}/inventory`,
      { params: { id: edition!.id }, body: { count: 3 } },
    );
    expect(editionRes.status).toBe(400);
    expect(editionRes.json.error).toMatch(/edition/i);
  });

  it("applies field changes atomically", async () => {
    const { id } = await createDraft("Fields Tee");
    const path = `/api/internal/shop/products/${id}/fields`;
    const ok = await call(fieldsPOST, "POST", path, {
      params: { id },
      body: {
        changes: [
          { id, field: "priceCents", value: 3500 },
          { id, field: "eyebrow", value: "New" },
        ],
      },
    });
    expect(ok.json).toMatchObject({ ok: true, applied: 2 });
    expect(await getProductForAdmin(id)).toMatchObject({ priceCents: 3500, eyebrow: "New" });

    const failing = await call(fieldsPOST, "POST", path, {
      params: { id },
      body: {
        changes: [
          { id, field: "eyebrow", value: "Changed" },
          { id, field: "priceCents", value: -5 },
        ],
      },
    });
    expect(failing.status).toBe(400);
    expect(failing.json).toMatchObject({ ok: false, failedIndex: 1 });
    expect((await getProductForAdmin(id))?.eyebrow).toBe("New");

    for (const body of [{}, { changes: [] }, { changes: [{ id, field: "eyebrow" }] }]) {
      expect((await call(fieldsPOST, "POST", path, { params: { id }, body })).status).toBe(400);
    }
    const other = await call(fieldsPOST, "POST", path, {
      params: { id },
      body: { changes: [{ id: "someone-else", field: "eyebrow", value: "x" }] },
    });
    expect(other.status).toBe(400);
  });
});

describe("customers", () => {
  it("lists customers and reads one by URL-encoded normalized email", async () => {
    await paidOrder("ship", "Key.Customer@Example.com");
    const list = await call(customersGET, "GET", "/api/internal/shop/customers");
    const row = list.json.customers.find(
      (c: { key: string }) => c.key === "key.customer@example.com",
    );
    expect(row).toBeTruthy();

    const key = encodeURIComponent("key.customer@example.com");
    const one = await call(customerGET, "GET", `/api/internal/shop/customers/${key}`, {
      params: { key },
    });
    expect(one.status).toBe(200);
    expect(one.json.customer.email.toLowerCase()).toBe("key.customer@example.com");
    const none = await call(
      customerGET,
      "GET",
      "/api/internal/shop/customers/nobody%40example.com",
      {
        params: { key: "nobody%40example.com" },
      },
    );
    expect(none.status).toBe(404);
  });
});

describe("settings", () => {
  it("reads and patches settings, rejecting what the admin form rejects", async () => {
    const path = "/api/internal/shop/settings";
    const read = await call(settingsGET, "GET", path);
    expect(read.json.settings.id).toBe("default");

    const ok = await call(settingsPOST, "POST", path, {
      body: {
        shopPaused: true,
        pauseNote: "  Back Thursday  ",
        shipCountries: ["us", " ca "],
        returnsPolicy: "   ",
      },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.settings).toMatchObject({
      shopPaused: true,
      pauseNote: "Back Thursday",
      shipCountries: ["US", "CA"],
      returnsPolicy: null,
    });
    expect((await getStoreSettings()).shopPaused).toBe(true);

    const bads: unknown[] = [
      { storeName: "  " },
      { supportEmail: "not-an-email" },
      { shipCountries: [] },
      { shipCountries: ["USA"] },
      { shippingFlatCents: -1 },
      { shippingFlatCents: 5.5 },
      { shippingFreeOverCents: "100" },
      { pauseNote: "x".repeat(141) },
      { shipsWithin: "x".repeat(61) },
      { shopPaused: "yes" },
      { somethingElse: 1 },
      { pickupEnabled: true, pickupAddress: "" },
    ];
    for (const body of bads) {
      const res = await call(settingsPOST, "POST", path, { body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.json.ok).toBe(false);
    }
    const notObject = await call(settingsPOST, "POST", path, { body: [1] });
    expect(notObject.status).toBe(400);

    await call(settingsPOST, "POST", path, { body: { shopPaused: false, pauseNote: null } });
  });
});
