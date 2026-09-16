import { describe, expect, it } from "vitest";
import { orderTimeline, type TimelineInput } from "@/lib/orderTracking";

const base: TimelineInput = {
  status: "paid",
  fulfilment: "ship",
  paidAt: "2026-09-14T18:42:00.000Z",
  fulfilledAt: null,
  carrier: null,
  trackingNumber: null,
};

describe("orderTimeline", () => {
  it("is null for a refunded order — that's a different line, not a fourth step", () => {
    expect(orderTimeline({ ...base, status: "refunded" })).toBeNull();
  });

  it("marks only payment done for a paid, unshipped ship order", () => {
    const steps = orderTimeline(base);
    expect(steps?.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps?.[1]?.detail).toBe("Not shipped yet");
    expect(steps?.[2]?.detail).toBe("Nothing to track until it ships.");
  });

  it("shows the carrier and tracking number once fulfilled", () => {
    const steps = orderTimeline({
      ...base,
      status: "fulfilled",
      fulfilledAt: "2026-09-15T09:04:00.000Z",
      carrier: "USPS",
      trackingNumber: "9400111899223197428217",
    });
    expect(steps?.map((s) => s.done)).toEqual([true, true, false]);
    expect(steps?.[1]?.detail).toBe("USPS · 9400111899223197428217");
    expect(steps?.[2]?.detail).toBe(
      "Check the carrier's own tracking link above for delivery scans.",
    );
  });

  it("says shipped with no carrier/tracking on file yet", () => {
    const steps = orderTimeline({ ...base, status: "fulfilled" });
    expect(steps?.[1]?.detail).toBe("Shipped");
  });

  it("never claims payment when there's no paidAt, regardless of status", () => {
    const steps = orderTimeline({ ...base, status: "fulfilled", paidAt: null });
    expect(steps?.[0]?.done).toBe(false);
  });

  it("walks a pickup order through ready, then picked up", () => {
    const pickupBase: TimelineInput = { ...base, fulfilment: "pickup" };

    expect(orderTimeline(pickupBase)?.map((s) => s.done)).toEqual([true, false, false]);
    expect(
      orderTimeline({ ...pickupBase, status: "ready_for_pickup" })?.map((s) => s.done),
    ).toEqual([true, true, false]);
    expect(orderTimeline({ ...pickupBase, status: "picked_up" })?.map((s) => s.done)).toEqual([
      true,
      true,
      true,
    ]);
  });
});
