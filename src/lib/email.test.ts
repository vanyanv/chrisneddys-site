import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { getDb } from "@/db/client";
import { seedCatalogue } from "@/db/seed";
import * as schema from "@/db/schema";
import {
  createPendingOrder,
  getOrder,
  markPaid,
  markRefunded,
  setFulfilment,
  updateStoreSettings,
  type OrderWithItems,
} from "@/lib/orders";
import {
  isEmailConfigured,
  sendOrderConfirmation,
  sendOwnerInvite,
  sendPasswordReset,
  sendPickupReady,
  sendRefundConfirmation,
  sendShippingNotice,
} from "@/lib/email";

// `email.ts` carries `import "server-only"`, which throws outside a real
// Next.js server build — see the note in
// src/app/api/checkout/route.test.ts.
vi.mock("server-only", () => ({}));

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const SLUG = "foam-trucker-blue";

beforeAll(async () => {
  const db = (await getDb()) as unknown as PgliteDatabase<typeof schema>;
  await migrate(db, { migrationsFolder });
  await seedCatalogue(db);
});

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.EMAIL_REPLY_TO;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A paid pickup order for one Foam Trucker — a real edition number assigned,
 * a real (default) pickup address to state in the copy. */
async function paidPickupOrder(): Promise<OrderWithItems> {
  const pending = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "pickup",
  });
  if ("code" in pending) throw new Error(`expected a pending order, got ${pending.code}`);
  await markPaid({
    orderId: pending.orderId,
    paymentIntentId: `pi_${pending.orderId}`,
    email: "buyer@example.com",
    name: "Buyer Person",
    shipTo: null,
    amounts: { subtotal: 4800, shipping: 0, tax: 0, total: 4800 },
  });
  const order = await getOrder(pending.orderId);
  if (!order) throw new Error("expected the order to exist after markPaid");
  return order;
}

/** A paid, shipped order for one Foam Trucker — real carrier/tracking on
 * file, a real shipping address, a real edition number. */
async function paidShipOrder(): Promise<OrderWithItems> {
  const pending = await createPendingOrder({
    items: [{ slug: SLUG, quantity: 1 }],
    fulfilment: "ship",
  });
  if ("code" in pending) throw new Error(`expected a pending order, got ${pending.code}`);
  await markPaid({
    orderId: pending.orderId,
    paymentIntentId: `pi_${pending.orderId}`,
    email: "buyer@example.com",
    name: "Buyer Person",
    shipTo: {
      name: "Buyer Person",
      line1: "123 Main St",
      line2: null,
      city: "Los Angeles",
      state: "CA",
      postalCode: "90028",
      country: "US",
    },
    amounts: { subtotal: 4800, shipping: 600, tax: 0, total: 5400 },
  });
  const setResult = await setFulfilment(pending.orderId, {
    carrier: "USPS",
    trackingNumber: "9400111899",
  });
  if (!setResult.ok) throw new Error(`expected setFulfilment to succeed, got ${setResult.error}`);
  const order = await getOrder(pending.orderId);
  if (!order) throw new Error("expected the fulfilled order to exist");
  return order;
}

function mockResendOk() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendOrderConfirmation", () => {
  it("is gated on RESEND_API_KEY / EMAIL_FROM and never throws when they're unset", async () => {
    const order = await paidPickupOrder();
    const result = await sendOrderConfirmation(order);
    expect(result).toEqual({
      sent: false,
      reason: "Resend isn't configured (RESEND_API_KEY / EMAIL_FROM).",
    });
  });

  it("renders the order number, the edition line, totals, the pickup note and support email, and posts to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const editionNumber = order.items[0]?.editionNumber;
    expect(editionNumber).toEqual(expect.any(Number));

    const result = await sendOrderConfirmation(order);
    expect(result).toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_fake");

    const payload = JSON.parse(init.body);
    expect(payload.from).toBe("orders@chrisneddys.com");
    expect(payload.to).toBe("buyer@example.com");
    expect(payload.subject).toBe(
      `Order ${order.number} confirmed — number ${editionNumber} of 50 is yours`,
    );
    // No reply-to promise in this email's copy, so none is set.
    expect(payload.reply_to).toBeUndefined();

    const text: string = payload.text;
    expect(text).toContain(`Order ${order.number}`);
    expect(text).toContain(`#${editionNumber} of 50`);
    expect(text).toContain(`Number ${editionNumber} is yours.`);
    expect(text).toContain("Total: $48.00");
    expect(text).toContain(
      "Pickup at 5539 W. Sunset Blvd, Los Angeles, CA 90028. Bring this email.",
    );
    expect(text).toContain("Questions? chris@chrisneddys.com");

    const html: string = payload.html;
    expect(html).toContain(`Order ${order.number}`);
    expect(html).toContain(`Number ${editionNumber} is yours.`);
    expect(html).toContain(`NUMBER ${editionNumber} OF 50`);
    expect(html).toContain("$48.00");
    expect(html).toContain("Pickup at 5539 W. Sunset Blvd, Los Angeles, CA 90028");
  });

  it("includes the returns policy when the store has one set", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const set = await updateStoreSettings({ returnsPolicy: "Returns within 14 days, unworn." });
    expect(set.ok).toBe(true);

    const order = await paidPickupOrder();
    await sendOrderConfirmation(order);

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.text).toContain("Returns within 14 days, unworn.");

    // Reset so later tests in this file see the default (unset) policy.
    await updateStoreSettings({ returnsPolicy: null });
  });

  it("reports no recipient rather than sending to an empty address", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const pending = await createPendingOrder({
      items: [{ slug: SLUG, quantity: 1 }],
      fulfilment: "pickup",
    });
    if ("code" in pending) throw new Error(`expected a pending order, got ${pending.code}`);
    const order = await getOrder(pending.orderId);
    if (!order) throw new Error("expected the pending order to exist");

    const result = await sendOrderConfirmation(order);
    expect(result).toEqual({ sent: false, reason: "No recipient email address." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the generic subject for an order with no numbered items", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    // A quantity-only order has no edition number to print — simulate one
    // without needing a second, non-editioned seed product.
    const noEditionOrder = {
      ...order,
      items: order.items.map((i) => ({ ...i, editionNumber: null })),
    };

    const result = await sendOrderConfirmation(noEditionOrder);
    expect(result).toEqual({ sent: true });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.subject).toBe(`Order ${order.number} confirmed — Chris N Eddy's`);
  });
});

describe("sendShippingNotice", () => {
  it("states the carrier and tracking number", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidShipOrder();

    const result = await sendShippingNotice(order);
    expect(result).toEqual({ sent: true });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.subject).toBe(`Order ${order.number} shipped — USPS`);
    expect(payload.text).toContain("Carrier: USPS");
    expect(payload.text).toContain("Tracking number: 9400111899");
    expect(payload.text).toContain("123 Main St");
    // The body promises "reply to this email — it reaches a person", so a
    // reply-to has to actually be set — defaults to the store's support
    // address when EMAIL_REPLY_TO isn't configured.
    expect(payload.reply_to).toBe("chris@chrisneddys.com");

    const html: string = payload.html;
    expect(html).toContain("USPS");
    expect(html).toContain("9400111899");
    expect(html).toContain("123 Main St");
  });

  it("falls back to the generic subject when there's no carrier on file", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidShipOrder();
    const result = await sendShippingNotice({ ...order, carrier: null, trackingNumber: null });
    expect(result).toEqual({ sent: true });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.subject).toBe(`Order ${order.number} has shipped — Chris N Eddy's`);
  });

  it("uses EMAIL_REPLY_TO for the reply-to address when it's configured", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    process.env.EMAIL_REPLY_TO = "hello@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidShipOrder();
    await sendShippingNotice(order);

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.reply_to).toBe("hello@chrisneddys.com");
  });
});

describe("sendRefundConfirmation", () => {
  it("is gated on RESEND_API_KEY / EMAIL_FROM and never throws when they're unset", async () => {
    const order = await paidPickupOrder();
    const result = await sendRefundConfirmation(order);
    expect(result).toEqual({
      sent: false,
      reason: "Resend isn't configured (RESEND_API_KEY / EMAIL_FROM).",
    });
  });

  it("states the refunded amount, the order's edition number and totals, and posts to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const editionNumber = order.items[0]?.editionNumber;
    expect(editionNumber).toEqual(expect.any(Number));

    const refundResult = await markRefunded(order.id, {});
    expect(refundResult.ok).toBe(true);
    const refunded = await getOrder(order.id);
    if (!refunded) throw new Error("expected the refunded order to exist");

    const result = await sendRefundConfirmation(refunded);
    expect(result).toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");

    const payload = JSON.parse(init.body);
    expect(payload.to).toBe("buyer@example.com");
    expect(payload.subject).toBe(`Refunded $48.00 for order ${order.number}`);
    // The body promises a reply reaches Chris or Eddy, so a reply-to has to
    // actually be set — defaults to the store's support address.
    expect(payload.reply_to).toBe("chris@chrisneddys.com");

    const text: string = payload.text;
    expect(text).toContain(`Order ${order.number}`);
    expect(text).toContain(`#${editionNumber} of 50`);
    expect(text).toContain("Total: $48.00");
    expect(text).toContain("$48.00 is on its way back to you.");
    expect(text).toContain("Questions? chris@chrisneddys.com");

    const html: string = payload.html;
    expect(html).toContain(`Order ${order.number}`);
    expect(html).toContain(`NUMBER ${editionNumber} OF 50`);
    expect(html).toContain("$48.00");
    expect(html).toContain("Refunded");
  });

  it("reports no recipient rather than sending to an empty address", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const refundResult = await markRefunded(order.id, {});
    expect(refundResult.ok).toBe(true);
    const refunded = await getOrder(order.id);
    if (!refunded) throw new Error("expected the refunded order to exist");

    const result = await sendRefundConfirmation({ ...refunded, email: null });
    expect(result).toEqual({ sent: false, reason: "No recipient email address." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits the release line when the order wasn't released", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const refundResult = await markRefunded(order.id, {});
    expect(refundResult.ok).toBe(true);
    const refunded = await getOrder(order.id);
    if (!refunded) throw new Error("expected the refunded order to exist");

    // No `options` at all — the webhook's own backstop call site never
    // passes one, so this is also the "not explicitly told to" default.
    await sendRefundConfirmation(refunded);

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.text).not.toContain("gone back into the run");
    expect(payload.html).not.toContain("gone back into the run");
  });

  it("uses EMAIL_REPLY_TO for the reply-to address when it's configured", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    process.env.EMAIL_REPLY_TO = "hello@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const refundResult = await markRefunded(order.id, {});
    expect(refundResult.ok).toBe(true);
    const refunded = await getOrder(order.id);
    if (!refunded) throw new Error("expected the refunded order to exist");

    await sendRefundConfirmation(refunded);

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.reply_to).toBe("hello@chrisneddys.com");
  });

  it("states the released number when the order was released", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const editionNumber = order.items[0]?.editionNumber;
    expect(editionNumber).toEqual(expect.any(Number));

    const refundResult = await markRefunded(order.id, { release: true });
    expect(refundResult.ok).toBe(true);
    if (refundResult.ok) expect(refundResult.releasedEditionNumbers).toEqual([editionNumber]);
    const refunded = await getOrder(order.id);
    if (!refunded) throw new Error("expected the refunded order to exist");

    await sendRefundConfirmation(refunded, { released: true });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    const line = `Number ${editionNumber} has gone back into the run, so somebody else gets to have it.`;
    expect(payload.text).toContain(line);
    expect(payload.html).toContain(line);
  });
});

describe("sendPickupReady", () => {
  it("states the pickup address and the bring-this-email line", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const order = await paidPickupOrder();
    const result = await sendPickupReady(order);
    expect(result).toEqual({ sent: true });

    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(payload.subject).toBe(`Order ${order.number} is ready for pickup — Chris N Eddy's`);
    expect(payload.text).toContain(
      "Pickup at 5539 W. Sunset Blvd, Los Angeles, CA 90028. Bring this email.",
    );
  });
});

describe("sendPasswordReset", () => {
  it("is gated on RESEND_API_KEY / EMAIL_FROM and never throws when they're unset", async () => {
    const result = await sendPasswordReset(
      "owner@example.com",
      "https://chrisneddys.com/admin/reset-password?token=abc123",
    );
    expect(result).toEqual({
      sent: false,
      reason: "Resend isn't configured (RESEND_API_KEY / EMAIL_FROM).",
    });
  });

  it("posts a single-link, plain-text reset email to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const url = "https://chrisneddys.com/admin/reset-password?token=abc123";
    const result = await sendPasswordReset("owner@example.com", url);
    expect(result).toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe("owner@example.com");
    expect(payload.subject).toBe("Reset your password — Chris N Eddy's");

    const text: string = payload.text;
    expect(text.split(url)).toHaveLength(2); // occurs exactly once
    expect(text).toContain("one hour");
    expect(text).toContain("once");
    expect(text).toContain("ignore this email");
  });
});

describe("sendOwnerInvite", () => {
  it("is gated on RESEND_API_KEY / EMAIL_FROM and never throws when they're unset", async () => {
    const result = await sendOwnerInvite(
      "newowner@example.com",
      "https://chrisneddys.com/admin/accept-invite?token=xyz789",
    );
    expect(result).toEqual({
      sent: false,
      reason: "Resend isn't configured (RESEND_API_KEY / EMAIL_FROM).",
    });
  });

  it("posts a single-link, plain-text invite email to Resend", async () => {
    process.env.RESEND_API_KEY = "re_test_fake";
    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    const fetchMock = mockResendOk();

    const url = "https://chrisneddys.com/admin/accept-invite?token=xyz789";
    const result = await sendOwnerInvite("newowner@example.com", url);
    expect(result).toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe("newowner@example.com");
    expect(payload.subject).toBe("You're invited to the Chris N Eddy's admin");

    const text: string = payload.text;
    expect(text.split(url)).toHaveLength(2); // occurs exactly once
    expect(text).toContain("invited");
    expect(text).toContain("set your password");
  });
});

describe("isEmailConfigured", () => {
  it("is false when either env var is missing, true once both are set", () => {
    expect(isEmailConfigured()).toBe(false);

    process.env.EMAIL_FROM = "orders@chrisneddys.com";
    expect(isEmailConfigured()).toBe(false);

    process.env.RESEND_API_KEY = "re_test_fake";
    expect(isEmailConfigured()).toBe(true);

    delete process.env.EMAIL_FROM;
    expect(isEmailConfigured()).toBe(false);
  });
});
