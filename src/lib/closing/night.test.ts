import { describe, expect, it } from "vitest";
import { locations } from "@/data/locations";
import { businessDate, closingWindow, recentBusinessDates, windowState } from "./night";

const vannuys = locations.find((l) => l.id === "vannuys")!;
const opts = { opensBeforeMin: 30, graceMin: 60 };
const iso = (d: Date) => d.toISOString();

describe("businessDate", () => {
  it("keeps times before 06:00 LA on the previous date", () => {
    expect(businessDate(new Date("2026-10-07T12:59:00Z"))).toBe("2026-10-06"); // 05:59 PDT
    expect(businessDate(new Date("2026-10-07T08:30:00Z"))).toBe("2026-10-06"); // 01:30 PDT
  });
  it("switches at 06:00 LA", () => {
    expect(businessDate(new Date("2026-10-07T13:00:00Z"))).toBe("2026-10-07");
    expect(businessDate(new Date("2026-10-07T20:00:00Z"))).toBe("2026-10-07");
  });
  it("uses LA, not UTC, for the calendar date", () => {
    expect(businessDate(new Date("2026-10-08T05:00:00Z"))).toBe("2026-10-07"); // 22:00 PDT
  });
});

describe("closingWindow", () => {
  it("Tuesday night closes Wednesday 01:00", () => {
    const w = closingWindow(vannuys, "2026-10-06", opts)!;
    expect(iso(w.closesAt)).toBe("2026-10-07T08:00:00.000Z");
    expect(iso(w.opensAt)).toBe("2026-10-07T07:30:00.000Z");
    expect(iso(w.endsAt)).toBe("2026-10-07T09:00:00.000Z");
  });
  it("Friday night closes Saturday 02:00", () => {
    const w = closingWindow(vannuys, "2026-10-09", opts)!;
    expect(iso(w.closesAt)).toBe("2026-10-10T09:00:00.000Z");
  });
  it("returns null with no hours", () => {
    const glendale = locations.find((l) => l.id === "glendale")!;
    expect(closingWindow(glendale, "2026-10-06", opts)).toBeNull();
  });
  it("handles the spring-forward weekend (2026-03-08)", () => {
    // Friday night: 02:00 PST Saturday.
    expect(iso(closingWindow(vannuys, "2026-03-06", opts)!.closesAt)).toBe(
      "2026-03-07T10:00:00.000Z",
    );
    // Saturday night: 02:00 never happens on Sunday; lands on 03:00 PDT.
    expect(iso(closingWindow(vannuys, "2026-03-07", opts)!.closesAt)).toBe(
      "2026-03-08T10:00:00.000Z",
    );
    // Sunday night: 02:00 PDT Monday.
    expect(iso(closingWindow(vannuys, "2026-03-08", opts)!.closesAt)).toBe(
      "2026-03-09T09:00:00.000Z",
    );
  });
  it("handles the fall-back weekend (2026-11-01)", () => {
    // Saturday night: 02:00 PST Sunday, after the clocks go back.
    expect(iso(closingWindow(vannuys, "2026-10-31", opts)!.closesAt)).toBe(
      "2026-11-01T10:00:00.000Z",
    );
    // Sunday night: 02:00 PST Monday.
    expect(iso(closingWindow(vannuys, "2026-11-01", opts)!.closesAt)).toBe(
      "2026-11-02T10:00:00.000Z",
    );
    // Monday night: 01:00 PST Tuesday.
    expect(iso(closingWindow(vannuys, "2026-11-02", opts)!.closesAt)).toBe(
      "2026-11-03T09:00:00.000Z",
    );
  });
});

describe("windowState and recentBusinessDates", () => {
  const w = closingWindow(vannuys, "2026-10-06", opts)!;
  it("is before, open, after", () => {
    expect(windowState(new Date("2026-10-07T07:29:59Z"), w)).toBe("before");
    expect(windowState(new Date("2026-10-07T07:30:00Z"), w)).toBe("open");
    expect(windowState(new Date("2026-10-07T09:00:00Z"), w)).toBe("open");
    expect(windowState(new Date("2026-10-07T09:00:01Z"), w)).toBe("after");
  });
  it("lists dates newest first", () => {
    expect(recentBusinessDates(new Date("2026-10-07T08:30:00Z"), 3)).toEqual([
      "2026-10-06",
      "2026-10-05",
      "2026-10-04",
    ]);
  });
});
