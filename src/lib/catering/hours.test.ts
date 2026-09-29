import { describe, expect, it } from "vitest";
import type { CateringDayOff, CateringHours as DbCateringHours } from "@/db/schema";
import { toScheduleDaysOff, toScheduleHours } from "./hours";

function week(windows: { open: string; close: string }[]): Record<string, typeof windows> {
  const days: Record<string, typeof windows> = {};
  for (let d = 0; d <= 6; d++) days[String(d)] = windows;
  return days;
}

describe("toScheduleHours", () => {
  it("converts an open window per weekday for every catering store", () => {
    const dbHours: DbCateringHours = {
      hollywood: week([{ open: "10:00", close: "20:00" }]),
      vannuys: week([{ open: "11:00", close: "21:00" }]),
    };
    const result = toScheduleHours(dbHours);
    expect(result.hollywood[0]).toEqual({
      closed: false,
      windows: [{ open: "10:00", close: "20:00" }],
    });
    expect(result.vannuys[3]).toEqual({
      closed: false,
      windows: [{ open: "11:00", close: "21:00" }],
    });
  });

  it("treats an empty windows array as closed", () => {
    const dbHours: DbCateringHours = {
      hollywood: { ...week([{ open: "10:00", close: "20:00" }]), "0": [] },
      vannuys: week([{ open: "10:00", close: "20:00" }]),
    };
    const result = toScheduleHours(dbHours);
    expect(result.hollywood[0]).toEqual({ closed: true });
  });

  it("degrades a missing store or weekday to closed rather than throwing", () => {
    const dbHours: DbCateringHours = { hollywood: { "1": [{ open: "10:00", close: "20:00" }] } };
    const result = toScheduleHours(dbHours);
    expect(result.hollywood[0]).toEqual({ closed: true });
    expect(result.hollywood[1]).toEqual({
      closed: false,
      windows: [{ open: "10:00", close: "20:00" }],
    });
    expect(result.vannuys[1]).toEqual({ closed: true });
  });
});

describe("toScheduleDaysOff", () => {
  it("collapses a date off at every catering store into `all`", () => {
    const dbDaysOff: CateringDayOff[] = [
      { date: "2026-12-25", store: "hollywood" },
      { date: "2026-12-25", store: "vannuys" },
    ];
    const result = toScheduleDaysOff(dbDaysOff);
    expect(result.all).toEqual(["2026-12-25"]);
    expect(result.byStore).toEqual({});
  });

  it("keeps a single-store day off under byStore", () => {
    const dbDaysOff: CateringDayOff[] = [{ date: "2026-11-01", store: "hollywood" }];
    const result = toScheduleDaysOff(dbDaysOff);
    expect(result.all).toEqual([]);
    expect(result.byStore.hollywood).toEqual(["2026-11-01"]);
    expect(result.byStore.vannuys).toBeUndefined();
  });

  it("ignores a day off for a store the library doesn't know", () => {
    const dbDaysOff: CateringDayOff[] = [{ date: "2026-11-01", store: "glendale" }];
    const result = toScheduleDaysOff(dbDaysOff);
    expect(result.all).toEqual([]);
    expect(result.byStore).toEqual({});
  });
});
