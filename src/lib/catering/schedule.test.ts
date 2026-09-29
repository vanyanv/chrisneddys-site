import { describe, expect, it } from "vitest";
import {
  dayStatus,
  driverLeavesMs,
  earliestAllowed,
  DEFAULT_LEAD_HOURS,
  readyByMs,
  slotsForDate,
  slotToUtcMs,
} from "./schedule";
import { zonedTimeToUtcMs } from "./timezone";
import type { CateringHours, DaysOff, Weekday } from "./types";

const ALL_DAYS_OPEN_10_TO_8: CateringHours = {
  hollywood: Object.fromEntries(
    ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => [
      d,
      { windows: [{ open: "10:00", close: "20:00" }] },
    ]),
  ) as CateringHours["hollywood"],
  vannuys: Object.fromEntries(
    ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((d) => [
      d,
      { windows: [{ open: "10:00", close: "20:00" }] },
    ]),
  ) as CateringHours["vannuys"],
};

const NO_DAYS_OFF: DaysOff = { all: [], byStore: {} };

describe("earliestAllowed", () => {
  it("is 48 hours from now by default, for every order", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "12:00");
    expect(earliestAllowed(now)).toBe(now + 48 * 60 * 60 * 1000);
    expect(DEFAULT_LEAD_HOURS).toBe(48);
  });

  it("follows the notice setting when one is passed", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "12:00");
    expect(earliestAllowed(now, 24)).toBe(now + 24 * 60 * 60 * 1000);
    expect(earliestAllowed(now, 72)).toBe(now + 72 * 60 * 60 * 1000);
  });
});

describe("slotsForDate", () => {
  it("returns every 30-minute slot on an open day, far enough in the future", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const slots = slotsForDate("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now);
    expect(slots[0]).toBe("10:00");
    expect(slots[slots.length - 1]).toBe("20:00");
    expect(slots).toHaveLength(21); // 10:00 through 20:00 inclusive, every 30 min
  });

  it("is empty on a day off", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const daysOff: DaysOff = { all: ["2026-10-10"], byStore: {} };
    expect(slotsForDate("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now)).toEqual(
      [],
    );
  });

  it("is empty on a store-specific day off, but not for the other store", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const daysOff: DaysOff = { all: [], byStore: { hollywood: ["2026-10-10"] } };
    expect(slotsForDate("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now)).toEqual(
      [],
    );
    expect(
      slotsForDate("2026-10-10", "vannuys", ALL_DAYS_OPEN_10_TO_8, daysOff, now).length,
    ).toBeGreaterThan(0);
  });

  it("is empty when the store has no hours that weekday", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const hours: CateringHours = {
      ...ALL_DAYS_OPEN_10_TO_8,
      hollywood: { ...ALL_DAYS_OPEN_10_TO_8.hollywood, 6: { closed: true } },
    };
    // 2026-10-10 is a Saturday (weekday 6).
    expect(slotsForDate("2026-10-10", "hollywood", hours, NO_DAYS_OFF, now)).toEqual([]);
  });

  it("excludes a slot that starts exactly one minute before the 48h cutoff", () => {
    // Slot at 2026-10-03 12:00; cutoff is 48h before that.
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 48 * 60 * 60 * 1000 + 60 * 1000;
    const slots = slotsForDate("2026-10-03", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now);
    expect(slots).not.toContain("12:00");
  });

  it("includes a slot that starts exactly at the 48h cutoff", () => {
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 48 * 60 * 60 * 1000;
    const slots = slotsForDate("2026-10-03", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now);
    expect(slots).toContain("12:00");
  });

  it("applies the same 48h cutoff whatever the order size (no longer notice for big orders)", () => {
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 50 * 60 * 60 * 1000; // 50h out: clears 48h
    const slots = slotsForDate("2026-10-03", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now);
    expect(slots).toContain("12:00");
  });

  it("uses the notice setting when one is passed", () => {
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 50 * 60 * 60 * 1000;
    const longer = slotsForDate(
      "2026-10-03",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      72,
    );
    expect(longer).not.toContain("12:00");
  });
});

describe("dayStatus", () => {
  const now = zonedTimeToUtcMs("2026-10-01", "09:00");

  it("is past for a date before today in Los Angeles", () => {
    expect(dayStatus("2026-09-30", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now)).toBe(
      "past",
    );
  });

  it("is closed for a day off", () => {
    const daysOff: DaysOff = { all: ["2026-10-10"], byStore: {} };
    expect(dayStatus("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now)).toBe(
      "closed",
    );
  });

  it("is too-soon for today when the lead time rules out every slot", () => {
    const today = zonedTimeToUtcMs("2026-10-01", "09:00");
    expect(dayStatus("2026-10-01", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, today)).toBe(
      "too-soon",
    );
  });

  it("is open for a day far enough out with hours", () => {
    expect(dayStatus("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now)).toBe(
      "open",
    );
  });
});

describe("readyByMs / driverLeavesMs", () => {
  it("are 30 and 20 minutes before the slot", () => {
    const slotMs = slotToUtcMs("2026-10-10", "12:30");
    expect(readyByMs(slotMs)).toBe(slotMs - 30 * 60 * 1000);
    expect(driverLeavesMs(slotMs)).toBe(slotMs - 20 * 60 * 1000);
  });

  it("matches the crew ticket example (ready 12:00, driver 12:10, deliver 12:30)", () => {
    const slotMs = slotToUtcMs("2026-10-02", "12:30");
    expect(readyByMs(slotMs)).toBe(slotToUtcMs("2026-10-02", "12:00"));
    expect(driverLeavesMs(slotMs)).toBe(slotToUtcMs("2026-10-02", "12:10"));
  });
});
