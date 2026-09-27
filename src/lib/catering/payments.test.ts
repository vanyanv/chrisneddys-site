import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const captureMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const createIntentMock = vi.hoisted(() => vi.fn());
const createRefundMock = vi.hoisted(() => vi.fn());
const listCustomersMock = vi.hoisted(() => vi.fn());
const createCustomerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    paymentIntents: { capture: captureMock, cancel: cancelMock, create: createIntentMock },
    refunds: { create: createRefundMock },
    customers: { list: listCustomersMock, create: createCustomerMock },
  }),
}));

import {
  capturePaymentIntent,
  cancelPaymentIntent,
  chargeOffSession,
  fakeCheckoutIds,
  findOrCreateCustomer,
  isFakePaymentsMode,
  reauthorizeOffSession,
  refundPaymentIntent,
} from "./payments";

beforeEach(() => {
  delete process.env.CATERING_FAKE_PAYMENTS;
  delete process.env.VERCEL_ENV;
  captureMock.mockReset();
  cancelMock.mockReset();
  createIntentMock.mockReset();
  createRefundMock.mockReset();
  listCustomersMock.mockReset();
  createCustomerMock.mockReset();
});

describe("isFakePaymentsMode", () => {
  it("is false with nothing set", () => {
    expect(isFakePaymentsMode()).toBe(false);
  });

  it("is true when CATERING_FAKE_PAYMENTS=1 and VERCEL_ENV is unset", () => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
    expect(isFakePaymentsMode()).toBe(true);
  });

  it("throws rather than faking payments once VERCEL_ENV is set", () => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
    process.env.VERCEL_ENV = "preview";
    expect(() => isFakePaymentsMode()).toThrow();
  });
});

describe("fake mode: no Stripe calls", () => {
  beforeEach(() => {
    process.env.CATERING_FAKE_PAYMENTS = "1";
  });

  it("capture/cancel/refund/charge all succeed with fake ids and never touch Stripe", async () => {
    await expect(capturePaymentIntent("pi_1")).resolves.toEqual({ ok: true });
    await expect(cancelPaymentIntent("pi_1")).resolves.toEqual({ ok: true });

    const refunded = await refundPaymentIntent("pi_1", 500);
    expect(refunded.ok).toBe(true);
    if (refunded.ok) expect(refunded.refundId).toMatch(/^re_fake_/);

    const charged = await chargeOffSession({
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      amountCents: 500,
      description: "test",
    });
    expect(charged.ok).toBe(true);
    if (charged.ok) expect(charged.paymentIntentId).toMatch(/^pi_fake_/);

    const reauthorized = await reauthorizeOffSession("pi_old", {
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      amountCents: 700,
      description: "test",
    });
    expect(reauthorized.ok).toBe(true);

    expect(await findOrCreateCustomer("a@b.com")).toMatch(/^cus_fake_/);

    expect(captureMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(createIntentMock).not.toHaveBeenCalled();
    expect(createRefundMock).not.toHaveBeenCalled();
    expect(listCustomersMock).not.toHaveBeenCalled();
    expect(createCustomerMock).not.toHaveBeenCalled();
  });

  it("fakeCheckoutIds returns a distinct fake id per field", () => {
    const ids = fakeCheckoutIds();
    expect(ids.paymentIntentId).toMatch(/^pi_fake_/);
    expect(ids.customerId).toMatch(/^cus_fake_/);
    expect(ids.paymentMethodId).toMatch(/^pm_fake_/);
    expect(ids.checkoutSessionId).toMatch(/^cs_fake_/);
  });
});

describe("real mode: calls Stripe", () => {
  it("captures via Stripe", async () => {
    captureMock.mockResolvedValue({});
    const result = await capturePaymentIntent("pi_real");
    expect(result).toEqual({ ok: true });
    expect(captureMock).toHaveBeenCalledWith("pi_real");
  });

  it("returns ok:false with Stripe's error message on failure", async () => {
    cancelMock.mockRejectedValue(new Error("already canceled"));
    const result = await cancelPaymentIntent("pi_real");
    expect(result).toEqual({ ok: false, error: "already canceled" });
  });

  it("refundPaymentIntent is a no-op success for a zero/negative amount", async () => {
    const result = await refundPaymentIntent("pi_real", 0);
    expect(result).toEqual({ ok: true, refundId: null });
    expect(createRefundMock).not.toHaveBeenCalled();
  });

  it("reauthorizeOffSession cancels the old intent then creates a new manual-capture one", async () => {
    cancelMock.mockResolvedValue({});
    createIntentMock.mockResolvedValue({ id: "pi_new" });
    const result = await reauthorizeOffSession("pi_old", {
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      amountCents: 1000,
      description: "change",
    });
    expect(result).toEqual({ ok: true, paymentIntentId: "pi_new" });
    expect(cancelMock).toHaveBeenCalledWith("pi_old");
    expect(createIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: "manual", off_session: true, confirm: true }),
    );
  });

  it("findOrCreateCustomer reuses an existing Stripe customer by email", async () => {
    listCustomersMock.mockResolvedValue({ data: [{ id: "cus_existing" }] });
    const id = await findOrCreateCustomer("a@b.com");
    expect(id).toBe("cus_existing");
    expect(createCustomerMock).not.toHaveBeenCalled();
  });
});
