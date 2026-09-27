import { describe, expect, it } from "vitest";
import { laDateString, weekdayOf, zonedTimeToUtcMs } from "./timezone";

describe("zonedTimeToUtcMs", () => {
  it("converts a winter (PST, UTC-8) wall-clock time correctly", () => {
    const ms = zonedTimeToUtcMs("2026-01-15", "12:00");
    expect(new Date(ms).toISOString()).toBe("2026-01-15T20:00:00.000Z");
  });

  it("converts a summer (PDT, UTC-7) wall-clock time correctly", () => {
    const ms = zonedTimeToUtcMs("2026-07-15", "12:00");
    expect(new Date(ms).toISOString()).toBe("2026-07-15T19:00:00.000Z");
  });

  it("handles the spring-forward transition (2 AM doesn't exist)", () => {
    // Clocks in the US spring forward at 2 AM on 2026-03-08: 1:59:59 PST ->
    // 3:00:00 PDT. A time just before and just after should be exactly one
    // hour apart in UTC, not two.
    const before = zonedTimeToUtcMs("2026-03-08", "01:30");
    const after = zonedTimeToUtcMs("2026-03-08", "03:30");
    expect(after - before).toBe(60 * 60 * 1000);
  });

  it("handles the fall-back transition (1-2 AM happens twice)", () => {
    // Clocks fall back at 2 AM on 2026-11-01: 1:59:59 PDT -> 1:00:00 PST.
    // Noon before and after the transition should be exactly 25 hours apart
    // in UTC (an extra hour that day), not 24.
    const dayBefore = zonedTimeToUtcMs("2026-10-31", "12:00");
    const dayOf = zonedTimeToUtcMs("2026-11-01", "12:00");
    expect(dayOf - dayBefore).toBe(25 * 60 * 60 * 1000);
  });

  it("round-trips through laDateString", () => {
    const ms = zonedTimeToUtcMs("2026-06-01", "10:00");
    expect(laDateString(ms)).toBe("2026-06-01");
  });
});

describe("weekdayOf", () => {
  it("returns 0 for a Sunday", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
  });

  it("returns 5 for a Friday", () => {
    // Van Nuys' grand opening (see src/data/locations.ts).
    expect(weekdayOf("2026-09-25")).toBe(5);
  });
});
