import { describe, expect, it } from "vitest";
import {
  dayStatus,
  driverLeavesMs,
  earliestAllowed,
  leadHours,
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

describe("leadHours", () => {
  it("is 48 hours under 50 people", () => {
    expect(leadHours(1)).toBe(48);
    expect(leadHours(49)).toBe(48);
  });

  it("is 72 hours at 50 people or more", () => {
    expect(leadHours(50)).toBe(72);
    expect(leadHours(200)).toBe(72);
  });
});

describe("earliestAllowed", () => {
  it("adds the right number of hours to now", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "12:00");
    expect(earliestAllowed(now, 10)).toBe(now + 48 * 60 * 60 * 1000);
    expect(earliestAllowed(now, 50)).toBe(now + 72 * 60 * 60 * 1000);
  });
});

describe("slotsForDate", () => {
  it("returns every 30-minute slot on an open day, far enough in the future", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const slots = slotsForDate(
      "2026-10-10",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      10,
    );
    expect(slots[0]).toBe("10:00");
    expect(slots[slots.length - 1]).toBe("20:00");
    expect(slots).toHaveLength(21); // 10:00 through 20:00 inclusive, every 30 min
  });

  it("is empty on a day off", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const daysOff: DaysOff = { all: ["2026-10-10"], byStore: {} };
    expect(
      slotsForDate("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now, 10),
    ).toEqual([]);
  });

  it("is empty on a store-specific day off, but not for the other store", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const daysOff: DaysOff = { all: [], byStore: { hollywood: ["2026-10-10"] } };
    expect(
      slotsForDate("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now, 10),
    ).toEqual([]);
    expect(
      slotsForDate("2026-10-10", "vannuys", ALL_DAYS_OPEN_10_TO_8, daysOff, now, 10).length,
    ).toBeGreaterThan(0);
  });

  it("is empty when the store has no hours that weekday", () => {
    const now = zonedTimeToUtcMs("2026-10-01", "09:00");
    const hours: CateringHours = {
      ...ALL_DAYS_OPEN_10_TO_8,
      hollywood: { ...ALL_DAYS_OPEN_10_TO_8.hollywood, 6: { closed: true } },
    };
    // 2026-10-10 is a Saturday (weekday 6).
    expect(slotsForDate("2026-10-10", "hollywood", hours, NO_DAYS_OFF, now, 10)).toEqual([]);
  });

  it("excludes a slot that starts exactly one minute before the 48h cutoff", () => {
    // Slot at 2026-10-03 12:00; cutoff is 48h before that.
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 48 * 60 * 60 * 1000 + 60 * 1000;
    const slots = slotsForDate(
      "2026-10-03",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      10,
    );
    expect(slots).not.toContain("12:00");
  });

  it("includes a slot that starts exactly at the 48h cutoff", () => {
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 48 * 60 * 60 * 1000;
    const slots = slotsForDate(
      "2026-10-03",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      10,
    );
    expect(slots).toContain("12:00");
  });

  it("uses the 72h cutoff at 50 people, excluding a slot that clears 48h but not 72h", () => {
    const slotMs = zonedTimeToUtcMs("2026-10-03", "12:00");
    const now = slotMs - 50 * 60 * 60 * 1000; // 50h out: clears 48h, not 72h
    const smallParty = slotsForDate(
      "2026-10-03",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      10,
    );
    const bigParty = slotsForDate(
      "2026-10-03",
      "hollywood",
      ALL_DAYS_OPEN_10_TO_8,
      NO_DAYS_OFF,
      now,
      50,
    );
    expect(smallParty).toContain("12:00");
    expect(bigParty).not.toContain("12:00");
  });
});

describe("dayStatus", () => {
  const now = zonedTimeToUtcMs("2026-10-01", "09:00");

  it("is past for a date before today in Los Angeles", () => {
    expect(dayStatus("2026-09-30", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now, 10)).toBe(
      "past",
    );
  });

  it("is closed for a day off", () => {
    const daysOff: DaysOff = { all: ["2026-10-10"], byStore: {} };
    expect(dayStatus("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, daysOff, now, 10)).toBe(
      "closed",
    );
  });

  it("is too-soon for today when the lead time rules out every slot", () => {
    const today = zonedTimeToUtcMs("2026-10-01", "09:00");
    expect(
      dayStatus("2026-10-01", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, today, 10),
    ).toBe("too-soon");
  });

  it("is open for a day far enough out with hours", () => {
    expect(dayStatus("2026-10-10", "hollywood", ALL_DAYS_OPEN_10_TO_8, NO_DAYS_OFF, now, 10)).toBe(
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
