import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import { brand } from "@/data/brand";
import { getInventory } from "@/lib/catalog";
import { getOrder, updateStoreSettings } from "@/lib/orders";

// `server-only` throws when a module carrying it is resolved outside a real
// Next.js server build (it relies on the bundler's `react-server` export
// condition, which plain Node/Vitest resolution doesn't set) — every route
// module this file imports carries it (`shopStatus.ts`, indirectly `stripe.ts`),
// so it's stubbed the same way this repo already avoids it (see
// `src/lib/orders.admin-flow.test.ts`'s note on `ordersAdmin.ts`).
vi.mock("server-only", () => ({}));

const createMock = vi.hoisted(() => vi.fn());
// A fresh, unique session id per call — `orders.stripe_checkout_session_id`
// is unique, and several tests in this file each create their own order.
const stripeState = vi.hoisted(() => ({ lastId: "" }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createMock } } }),
}));

const migrationsFolder = fileURLToPath(new URL("../../../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

beforeEach(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  // `isShopOpenFor` also requires a published returns policy — the seeded
  // settings row has none (`returnsPolicy` is null by default), so every
  // "shop open" test needs one set to actually be open under the new
  // predicate. `supportEmail` is already non-empty from the seed.
  await updateStoreSettings({ returnsPolicy: "Returns accepted within 30 days, unworn." });
  createMock.mockReset();
  createMock.mockImplementation(async () => {
    stripeState.lastId = `cs_test_${Math.random().toString(36).slice(2)}`;
    return { id: stripeState.lastId, url: "https://checkout.stripe.com/pay/test" };
  });
});

async function post(body: unknown): Promise<Response> {
  const { POST } = await import("./route");
  const request = new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("POST /api/checkout — shop closed", () => {
  it("503s with no reservation when Stripe env vars aren't set", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const before = await getInventory(SLUG);
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/shop isn't open/i);
    expect(createMock).not.toHaveBeenCalled();

    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);
  });

  it("503s with no reservation when Stripe keys are set but no returns policy is published", async () => {
    const set = await updateStoreSettings({ returnsPolicy: null });
    expect(set.ok).toBe(true);

    const before = await getInventory(SLUG);
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/shop isn't open/i);
    expect(createMock).not.toHaveBeenCalled();

    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);
  });

  // issue #43 — a pre-launch shop that also happens to have `shopPaused`
  // left on (e.g. flipped once in a half-configured environment) must still
  // read as pre-launch, never as paused: `isShopOpenFor` is checked first in
  // the route, exactly so this can't get confused.
  it("keeps the pre-launch message even when shopPaused is also set", async () => {
    const set = await updateStoreSettings({ returnsPolicy: null, shopPaused: true });
    expect(set.ok).toBe(true);

    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/shop isn't open/i);
    expect(createMock).not.toHaveBeenCalled();

    // Reset for the "shop open" tests below.
    const reset = await updateStoreSettings({ shopPaused: false });
    expect(reset.ok).toBe(true);
  });
});

describe("POST /api/checkout — shop paused (issue #43)", () => {
  it("503s with a distinct message and no reservation while paused", async () => {
    const set = await updateStoreSettings({ shopPaused: true, pauseNote: "Back Thursday" });
    expect(set.ok).toBe(true);

    const before = await getInventory(SLUG);
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("paused");
    expect(body.error).toContain("Back Thursday");
    expect(body.error).not.toMatch(/isn't open yet/i);
    expect(createMock).not.toHaveBeenCalled();

    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);

    const reset = await updateStoreSettings({ shopPaused: false, pauseNote: null });
    expect(reset.ok).toBe(true);
  });

  it("stops a stale tab's checkout even with no note set", async () => {
    const set = await updateStoreSettings({ shopPaused: true, pauseNote: null });
    expect(set.ok).toBe(true);

    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(503);
    expect(createMock).not.toHaveBeenCalled();

    const reset = await updateStoreSettings({ shopPaused: false });
    expect(reset.ok).toBe(true);
  });
});

describe("POST /api/checkout — shop open", () => {
  it("sends a Vercel preview's shopper back to that preview, not the live domain", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "chrisneddys-site-git-x.vercel.app");
    try {
      const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "ship" });
      expect(res.status).toBe(200);
      const params = createMock.mock.calls[0]![0];
      expect(params.success_url).toBe(
        "https://chrisneddys-site-git-x.vercel.app/shop/thanks/?session_id={CHECKOUT_SESSION_ID}",
      );
      expect(params.cancel_url).toBe("https://chrisneddys-site-git-x.vercel.app/shop/?cancelled=1");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("builds a Checkout Session for a shipped order and reserves the cart", async () => {
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "ship" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/pay/test");

    expect(createMock).toHaveBeenCalledTimes(1);
    const params = createMock.mock.calls[0]![0];

    expect(params.mode).toBe("payment");
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0]).toMatchObject({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: 4800,
        product_data: {
          name: "Chris N Eddy's Foam Trucker — Blue (Capsule 01)",
          images: [`${brand.siteUrl}/shop/foam-trucker-blue/front.webp`],
          tax_code: "txcd_30011000",
        },
        tax_behavior: "exclusive",
      },
    });

    expect(params.phone_number_collection).toEqual({ enabled: true });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.invoice_creation).toEqual({ enabled: true });
    expect(params.integration_identifier).toBe("chrisneddys-shop-nwwxvyur");
    expect(params.client_reference_id).toBeTruthy();
    expect(params.success_url).toBe(
      `${brand.siteUrl}/shop/thanks/?session_id={CHECKOUT_SESSION_ID}`,
    );
    expect(params.cancel_url).toBe(`${brand.siteUrl}/shop/?cancelled=1`);

    // ~35 minutes out (the 30-minute hold plus Stripe's required margin),
    // allowing a few seconds of test-run slop.
    const expected = Math.floor(Date.now() / 1000) + 35 * 60;
    expect(params.expires_at).toBeGreaterThanOrEqual(expected - 5);
    expect(params.expires_at).toBeLessThanOrEqual(expected + 30);

    expect(params.metadata.fulfilment).toBe("ship");
    expect(params.metadata.orderNumber).toMatch(/^CNE-\d+$/);
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(params.shipping_options).toHaveLength(1);
    expect(params.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(600);
    expect(params.shipping_options[0].shipping_rate_data.display_name).toBe("Shipping");
    expect(params.shipping_options[0].shipping_rate_data.tax_code).toBe("txcd_92010001");
    expect(params.shipping_options[0].shipping_rate_data.tax_behavior).toBe("exclusive");

    // The order is pending, reserved, and findable by the session id this
    // route attached to it.
    const order = await getOrder(params.metadata.orderId);
    expect(order?.status).toBe("pending");
    expect(order?.stripeCheckoutSessionId).toBe(stripeState.lastId);
    expect(order?.items).toHaveLength(1);
  });

  it("omits shipping fields and marks pickup in metadata for a pickup order", async () => {
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(200);

    const params = createMock.mock.calls[0]![0];
    expect(params.shipping_address_collection).toBeUndefined();
    expect(params.shipping_options).toBeUndefined();
    expect(params.metadata.fulfilment).toBe("pickup");
  });

  it("returns a typed 4xx and reserves nothing for a quantity over the per-order limit", async () => {
    const before = await getInventory(SLUG);
    const res = await post({ items: [{ slug: SLUG, quantity: 7 }], fulfilment: "pickup" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("over_limit");
    expect(body.error).toBe("Only 6 per order.");
    expect(createMock).not.toHaveBeenCalled();

    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);
  });

  it("merges duplicate slug lines before validation, so the per-order limit can't be bypassed", async () => {
    // The Foam Trucker's `perOrderLimit` is 6 — each line here is within
    // the limit on its own, but the two together (12) are not, and must be
    // rejected as such rather than passing as two separate valid lines.
    const before = await getInventory(SLUG);
    const res = await post({
      items: [
        { slug: SLUG, quantity: 6 },
        { slug: SLUG, quantity: 6 },
      ],
      fulfilment: "pickup",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("over_limit");
    expect(createMock).not.toHaveBeenCalled();

    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);
  });

  it("rejects more than 10 line items before touching the database", async () => {
    const items = Array.from({ length: 11 }, () => ({ slug: SLUG, quantity: 1 }));
    const res = await post({ items, fulfilment: "pickup" });
    expect(res.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("releases the reservation immediately when Stripe can't be reached", async () => {
    createMock.mockReset();
    createMock.mockRejectedValueOnce(new Error("network unreachable"));

    const before = await getInventory(SLUG);
    const res = await post({ items: [{ slug: SLUG, quantity: 1 }], fulfilment: "pickup" });
    expect(res.status).toBe(502);

    // The pending order's reservation must not outlive a Checkout Session
    // that never existed.
    const after = await getInventory(SLUG);
    expect(after?.available).toBe(before?.available);
  });
});
