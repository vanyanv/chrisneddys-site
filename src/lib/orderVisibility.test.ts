import { describe, expect, it } from "vitest";
import { canShowFullOrderDetails, FULL_DETAIL_WINDOW_MS } from "@/lib/orderVisibility";

const now = new Date("2026-01-01T12:00:00Z");

describe("canShowFullOrderDetails", () => {
  it("always shows details for a pending order, regardless of paidAt", () => {
    expect(canShowFullOrderDetails({ status: "pending", paidAt: null }, now)).toBe(true);
  });

  it("shows details for a paid order right at payment time", () => {
    expect(canShowFullOrderDetails({ status: "paid", paidAt: now }, now)).toBe(true);
  });

  it("shows details right up to the edge of the window", () => {
    const paidAt = new Date(now.getTime() - FULL_DETAIL_WINDOW_MS);
    expect(canShowFullOrderDetails({ status: "paid", paidAt }, now)).toBe(true);
  });

  it("hides details just past the window", () => {
    const paidAt = new Date(now.getTime() - FULL_DETAIL_WINDOW_MS - 1000);
    expect(canShowFullOrderDetails({ status: "paid", paidAt }, now)).toBe(false);
  });

  it("hides details for a paid order with no paidAt at all", () => {
    expect(canShowFullOrderDetails({ status: "paid", paidAt: null }, now)).toBe(false);
  });

  it.each(["fulfilled", "ready_for_pickup", "picked_up", "refunded"] as const)(
    "applies the same window to a %s order",
    (status) => {
      const withinWindow = new Date(now.getTime() - 60 * 60 * 1000);
      const outsideWindow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      expect(canShowFullOrderDetails({ status, paidAt: withinWindow }, now)).toBe(true);
      expect(canShowFullOrderDetails({ status, paidAt: outsideWindow }, now)).toBe(false);
    },
  );
});
