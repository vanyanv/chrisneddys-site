import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({}) }));

import { confirmFromReturn } from "./confirmFromReturn";
import type { RetrievedCheckoutSession } from "./payments";

const db = {} as Db;
const session = (over: Partial<RetrievedCheckoutSession> = {}): RetrievedCheckoutSession => ({
  id: "cs_1",
  status: "complete",
  cateringOrderId: "ord_1",
  paymentIntentId: "pi_1",
  customerId: "cus_1",
  paymentMethodId: "pm_1",
  ...over,
});

function run(
  order: { id: string; status: string },
  sessionId: string | undefined,
  retrieved: RetrievedCheckoutSession | null,
) {
  const retrieveSession = vi.fn().mockResolvedValue(retrieved);
  const complete = vi.fn().mockResolvedValue(undefined);
  return confirmFromReturn(db, order, sessionId, { retrieveSession, complete }).then((r) => ({
    r,
    retrieveSession,
    complete,
  }));
}

describe("confirmFromReturn", () => {
  it("completes a draft order for a complete, matching session with the webhook's inputs", async () => {
    const { r, complete } = await run({ id: "ord_1", status: "draft" }, "cs_1", session());
    expect(r).toBe(true);
    expect(complete).toHaveBeenCalledWith(db, {
      orderId: "ord_1",
      checkoutSessionId: "cs_1",
      paymentIntentId: "pi_1",
      customerId: "cus_1",
      paymentMethodId: "pm_1",
    });
  });

  it("does nothing without a session_id", async () => {
    const { r, retrieveSession, complete } = await run(
      { id: "ord_1", status: "draft" },
      undefined,
      session(),
    );
    expect(r).toBe(false);
    expect(retrieveSession).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("skips Stripe entirely for an order already requested or booked", async () => {
    for (const status of ["requested", "booked"]) {
      const { r, retrieveSession, complete } = await run(
        { id: "ord_1", status },
        "cs_1",
        session(),
      );
      expect(r).toBe(false);
      expect(retrieveSession).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
    }
  });

  it("refuses a session that belongs to a different order", async () => {
    const { r, complete } = await run(
      { id: "ord_1", status: "draft" },
      "cs_1",
      session({ cateringOrderId: "ord_2" }),
    );
    expect(r).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses a session with no catering metadata (e.g. a shop session)", async () => {
    const { r, complete } = await run(
      { id: "ord_1", status: "draft" },
      "cs_1",
      session({ cateringOrderId: null }),
    );
    expect(r).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });

  it("refuses a session that is not complete", async () => {
    for (const status of ["open", "expired", null]) {
      const { r, complete } = await run(
        { id: "ord_1", status: "draft" },
        "cs_1",
        session({ status }),
      );
      expect(r).toBe(false);
      expect(complete).not.toHaveBeenCalled();
    }
  });

  it("does nothing when the session can't be retrieved (fake mode, bad id)", async () => {
    const { r, complete } = await run({ id: "ord_1", status: "draft" }, "cs_x", null);
    expect(r).toBe(false);
    expect(complete).not.toHaveBeenCalled();
  });
});
