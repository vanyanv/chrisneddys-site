import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getOrderById } from "@/lib/catering/orders";
import { saveCateringSettings } from "@/lib/catering/settings";
import { laDateString, zonedTimeToUtcMs } from "@/lib/catering";

vi.mock("server-only", () => ({}));

const createSessionMock = vi.hoisted(() => vi.fn());
const listCustomersMock = vi.hoisted(() => vi.fn());
const createCustomerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: createSessionMock } },
    customers: { list: listCustomersMock, create: createCustomerMock },
  }),
}));

const sendRequestReceivedMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
const sendOwnerNewRequestMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
vi.mock("@/lib/catering/emails", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/catering/emails")>("@/lib/catering/emails");
  return {
    ...actual,
    sendRequestReceivedEmail: sendRequestReceivedMock,
    sendOwnerNewRequestEmail: sendOwnerNewRequestMock,
  };
});

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

beforeEach(async () => {
  delete process.env.CATERING_FAKE_PAYMENTS;
  delete process.env.VERCEL_ENV;
  createSessionMock.mockReset();
  createSessionMock.mockImplementation(async () => ({
    id: `cs_test_${Math.random().toString(36).slice(2)}`,
    url: "https://checkout.stripe.com/pay/test",
  }));
  listCustomersMock.mockReset();
  listCustomersMock.mockResolvedValue({ data: [] });
  createCustomerMock.mockReset();
  createCustomerMock.mockResolvedValue({ id: "cus_test_1" });
  sendRequestReceivedMock.mockClear();
  sendOwnerNewRequestMock.mockClear();

  const saved = await saveCateringSettings({ orderingOn: true, daysOff: [] });
  expect(saved.ok).toBe(true);
});

function farEnoughDate(): string {
  const d = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** The half-hour slot (10:00-20:00 LA, the default hours) closest to
 * `hours` from now, so a test sits the same distance from the notice cutoff
 * whatever time of day it runs. */
function slotAboutHoursOut(hours: number): { date: string; time: string; hoursOut: number } {
  const target = Date.now() + hours * 60 * 60 * 1000;
  let best = { date: "", time: "", ms: Number.POSITIVE_INFINITY };
  for (let day = 0; day <= 6; day++) {
    const date = laDateString(Date.now() + day * 24 * 60 * 60 * 1000);
    for (let m = 10 * 60; m <= 20 * 60; m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const ms = zonedTimeToUtcMs(date, time);
      if (Math.abs(ms - target) < Math.abs(best.ms - target)) best = { date, time, ms };
    }
  }
  return { date: best.date, time: best.time, hoursOut: (best.ms - Date.now()) / 3_600_000 };
}

function bigLine() {
  return { itemId: "single-patty-slider", qty: 80, wayId: null, toppings: ["lettuce"], extras: [] };
}

function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    store: "hollywood",
    fulfilment: "pickup",
    date: farEnoughDate(),
    time: "12:00",
    lines: [
      {
        itemId: "single-patty-slider",
        qty: 12,
        wayId: null,
        toppings: ["lettuce"],
        extras: [],
      },
    ],
    tip: { percent: 10 },
    plateSets: 12,
    contact: { name: "Pat Customer", email: "pat@example.com", phone: "555-1234" },
    ...overrides,
  };
}

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("./route");
  const request = new NextRequest("http://localhost/api/catering/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("POST /api/catering/checkout — off", () => {
  it("503s with {error:'off'} when ordering is off", async () => {
    const saved = await saveCateringSettings({ orderingOn: false });
    expect(saved.ok).toBe(true);
    const res = await post(baseBody());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "off" });
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/catering/checkout — validation", () => {
  it("400s with field errors for missing contact info", async () => {
    const res = await post(baseBody({ contact: { name: "", email: "not-an-email", phone: "" } }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid");
    expect(body.fields["contact.name"]).toBeTruthy();
    expect(body.fields["contact.email"]).toBeTruthy();
    expect(body.fields["contact.phone"]).toBeTruthy();
  });

  it("400s for an unknown menu item, way, or extra (never trusts client lines)", async () => {
    const res = await post(
      baseBody({
        lines: [{ itemId: "not-a-real-item", qty: 1, wayId: null, toppings: [], extras: [] }],
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid");
    expect(Object.keys(body.fields).some((k) => k.startsWith("lines."))).toBe(true);
  });

  it("400s for an empty cart", async () => {
    const res = await post(baseBody({ lines: [] }));
    expect(res.status).toBe(400);
  });

  it("409s too-soon for a time inside the lead window", async () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours out
    const res = await post(
      baseBody({
        date: soon.toISOString().slice(0, 10),
        time: `${String(soon.getUTCHours()).padStart(2, "0")}:00`,
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "too-soon" });
  });

  it("gives a big order the same 48 hours' notice as any other, not 72", async () => {
    // About 60 hours out: past the 48 h notice, inside the old 72 h rule for
    // big orders.
    const slot = slotAboutHoursOut(60);
    expect(slot.hoursOut).toBeGreaterThan(50);
    expect(slot.hoursOut).toBeLessThan(70);
    const res = await post(baseBody({ date: slot.date, time: slot.time, lines: [bigLine()] }));
    expect(res.status).toBe(200);
  });

  it("409s too-soon inside 48 hours whatever the order size", async () => {
    const slot = slotAboutHoursOut(30);
    expect(slot.hoursOut).toBeLessThan(48);
    const res = await post(baseBody({ date: slot.date, time: slot.time, lines: [bigLine()] }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "too-soon" });
  });

  it("409s closed for a day the store has off", async () => {
    const date = farEnoughDate();
    const saved = await saveCateringSettings({ daysOff: [{ date, store: "hollywood" }] });
    expect(saved.ok).toBe(true);
    const res = await post(baseBody({ date }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "closed" });
  });

  it("409s out-of-range for a delivery address too far from the store", async () => {
    const res = await post(
      baseBody({
        fulfilment: "delivery",
        address: {
          line1: "1 Infinite Loop",
          city: "Cupertino",
          state: "CA",
          zip: "95014",
        },
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "out-of-range" });
  });

  it("accepts an unrecognized ZIP rather than rejecting it, and flags the order", async () => {
    const res = await post(
      baseBody({
        fulfilment: "delivery",
        address: { line1: "123 Main St", city: "Nowhere", state: "CA", zip: "00000" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const sessionParams = createSessionMock.mock.calls[0]![0];
    const order = await getOrderById(sessionParams.metadata.cateringOrderId);
    expect(order?.rangeUnknown).toBe(true);
    expect(body.url).toBeTruthy();
  });
});

describe("POST /api/catering/checkout — price recomputation", () => {
  it("ignores a stale expected total and recomputes from the menu", async () => {
    const res = await post(baseBody({ expectedTotalCents: 999_999_999 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "price-changed" });
  });

  it("prices lines from the menu, not from anything the client sends", async () => {
    const res = await post(baseBody());
    expect(res.status).toBe(200);
    const params = createSessionMock.mock.calls[0]![0];
    const order = await getOrderById(params.metadata.cateringOrderId);
    // Single Patty Slider is $6.49 × 12 = $77.88.
    expect(order?.foodCents).toBe(7788);
    expect(order?.items[0]?.unitCents).toBe(649);
  });
});

describe("POST /api/catering/checkout — real Stripe mode", () => {
  it("builds a manual-capture, off-session Checkout Session with catering metadata", async () => {
    const res = await post(baseBody());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/pay/test");

    const params = createSessionMock.mock.calls[0]![0];
    expect(params.mode).toBe("payment");
    expect(params.payment_intent_data).toMatchObject({
      capture_method: "manual",
      setup_future_usage: "off_session",
    });
    expect(params.metadata.cateringOrderId).toBeTruthy();
    expect(params.customer).toBe("cus_test_1");
    expect(params.cancel_url).toContain("/catering/order/?step=review&canceled=1");
    expect(params.success_url).toMatch(/\/catering\/order\/sent\/\?o=/);

    const order = await getOrderById(params.metadata.cateringOrderId);
    expect(order?.status).toBe("draft");
    expect(order?.stripeCheckoutSessionId).toBeTruthy();
    // The webhook, not this route, moves a real-mode order to "requested".
    expect(sendRequestReceivedMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/catering/checkout — fake payments mode", () => {
  it("skips Stripe entirely, marks the order requested, and sends both emails", async () => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
    const res = await post(baseBody());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^\/catering\/order\/sent\/\?o=/);
    expect(createSessionMock).not.toHaveBeenCalled();

    const token = new URL(body.url, "http://localhost").searchParams.get("o")!;
    const { getOrderByToken } = await import("@/lib/catering/orders");
    const order = await getOrderByToken(token);
    expect(order?.status).toBe("requested");
    expect(order?.stripePaymentIntentId).toMatch(/^pi_fake_/);
    expect(sendRequestReceivedMock).toHaveBeenCalledTimes(1);
    expect(sendOwnerNewRequestMock).toHaveBeenCalledTimes(1);
  });

  it("uses fake payments on Vercel Preview", async () => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
    process.env.VERCEL_ENV = "preview";
    const res = await post(baseBody());
    expect(res.status).toBe(200);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("throws rather than faking payments when VERCEL_ENV is also set", async () => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
    process.env.VERCEL_ENV = "production";
    await expect(post(baseBody())).rejects.toThrow();
  });
});
