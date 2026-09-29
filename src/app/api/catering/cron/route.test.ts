import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import {
  createDraftOrder,
  getOrderById,
  setStatus,
  type CreateDraftOrderInput,
} from "@/lib/catering/orders";

vi.mock("server-only", () => ({}));

const sendExpiredMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
const sendThankYouMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));
vi.mock("@/lib/catering/emails", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/catering/emails")>("@/lib/catering/emails");
  return { ...actual, sendExpiredEmail: sendExpiredMock, sendThankYouEmail: sendThankYouMock };
});

const migrationsFolder = fileURLToPath(new URL("../../../../../drizzle", import.meta.url));

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
});

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  sendExpiredMock.mockClear();
  sendThankYouMock.mockClear();
});

async function get(auth?: string): Promise<Response> {
  const { GET } = await import("./route");
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  const request = new NextRequest("http://localhost/api/catering/cron", { headers });
  return GET(request);
}

function baseDraftInput(overrides: Partial<CreateDraftOrderInput> = {}): CreateDraftOrderInput {
  return {
    store: "hollywood",
    fulfilment: "pickup",
    eventAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    contactName: "Pat Customer",
    contactEmail: "pat@example.com",
    contactPhone: "555-1234",
    items: [
      {
        itemId: "single-patty-slider",
        itemName: "Single Patty Slider",
        qty: 1,
        unitCents: 649,
        amountCents: 649,
      },
    ],
    foodCents: 649,
    taxCents: 63,
    totalCents: 712,
    ...overrides,
  };
}

describe("GET /api/catering/cron", () => {
  it("401s without the bearer secret", async () => {
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("401s with the wrong secret", async () => {
    const res = await get("Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("503s when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await get("Bearer anything");
    expect(res.status).toBe(503);
  });

  it("expires an overdue requested order and sends the expired email", async () => {
    const draft = await createDraftOrder(baseDraftInput());
    await setStatus(draft.orderId, "requested", {
      requestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      respondBy: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const res = await get("Bearer test-cron-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBeGreaterThanOrEqual(1);

    const order = await getOrderById(draft.orderId);
    expect(order?.status).toBe("expired");
    expect(sendExpiredMock).toHaveBeenCalled();
  });

  it("sends the day-after thank-you for a booked order whose event was yesterday", async () => {
    const draft = await createDraftOrder(
      baseDraftInput({ eventAt: new Date(Date.now() - 30 * 60 * 60 * 1000) }),
    );
    await setStatus(draft.orderId, "requested", {
      requestedAt: new Date(Date.now() - 60 * 60 * 60 * 1000),
      respondBy: new Date(Date.now() - 50 * 60 * 60 * 1000),
    });
    await setStatus(draft.orderId, "booked", {
      approvedAt: new Date(Date.now() - 55 * 60 * 60 * 1000),
    });

    const res = await get("Bearer test-cron-secret");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thankYous).toBeGreaterThanOrEqual(1);
    expect(sendThankYouMock).toHaveBeenCalled();

    const order = await getOrderById(draft.orderId);
    expect(order?.status).toBe("completed");
  });
});
