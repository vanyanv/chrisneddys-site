/**
 * Converts the database's catering-hours shape (`CateringHours` from
 * `src/db/schema.ts`: store → weekday *string* → an array of windows, an
 * empty array meaning closed) into the pure library's shape (`CateringHours`
 * from `types.ts`: store → weekday *number* → a `DaySchedule`), and the
 * database's flat days-off list into the library's `DaysOff` split.
 *
 * Two shapes exist because the database's is what Admin's settings form
 * edits directly (JSON-friendly string keys, an array standing in for
 * "closed"), while the library's is what `schedule.ts` wants to index with
 * (a `Weekday` number, and an explicit `{closed: true}` rather than an
 * empty array) — this module is the one place that bridges them.
 */
import type { CateringDayOff, CateringHours as DbCateringHours } from "@/db/schema";
import type { CateringStoreId } from "./stores";
import { CATERING_STORES, isCateringStoreId } from "./stores";
import type { CateringHours as LibCateringHours, DaySchedule, DaysOff, Weekday } from "./types";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** The database's `hours[store][weekday]` (an array of windows, empty means
 * closed) into the library's `DaySchedule`. */
function toDaySchedule(windows: { open: string; close: string }[] | undefined): DaySchedule {
  if (!windows || windows.length === 0) return { closed: true };
  return { closed: false, windows: windows.map((w) => ({ open: w.open, close: w.close })) };
}

/**
 * `db/schema.ts`'s `CateringHours` (string weekday keys, an empty array for
 * "closed") into the library's `CateringHours` (numeric `Weekday` keys, an
 * explicit `DaySchedule`). A store missing from `dbHours` entirely, or a
 * weekday missing from a store's week, reads as closed rather than
 * throwing — the settings row always covers every catering store, but a
 * hand-edited or partial row should still degrade to "closed", not crash
 * the storefront.
 */
export function toScheduleHours(dbHours: DbCateringHours): LibCateringHours {
  const result = {} as LibCateringHours;
  for (const store of CATERING_STORES) {
    const week = dbHours[store.id];
    const days = {} as Record<Weekday, DaySchedule>;
    for (const weekday of WEEKDAYS) {
      days[weekday] = toDaySchedule(week?.[String(weekday)]);
    }
    result[store.id] = days;
  }
  return result;
}

/**
 * `db/schema.ts`'s flat `CateringDayOff[]` (each `{date, store}`) into the
 * library's `DaysOff` split (`all` for a business-wide day off, `byStore`
 * per store) — the database always names a store, so "all" days off are
 * represented in the database as the same date repeated for every catering
 * store; this collapses that back into one `all` entry rather than leaving
 * a false negative for a store added after the fact.
 */
export function toScheduleDaysOff(dbDaysOff: CateringDayOff[]): DaysOff {
  const byDate = new Map<string, Set<CateringStoreId>>();
  for (const dayOff of dbDaysOff) {
    if (!isCateringStoreId(dayOff.store)) continue;
    const stores = byDate.get(dayOff.date) ?? new Set<CateringStoreId>();
    stores.add(dayOff.store);
    byDate.set(dayOff.date, stores);
  }

  const all: string[] = [];
  const byStore: Partial<Record<CateringStoreId, string[]>> = {};
  const everyStore = new Set(CATERING_STORES.map((s) => s.id));

  for (const [date, stores] of byDate) {
    if (everyStore.size > 0 && stores.size === everyStore.size) {
      all.push(date);
      continue;
    }
    for (const store of stores) {
      const list = byStore[store] ?? [];
      list.push(date);
      byStore[store] = list;
    }
  }

  return { all: all.sort(), byStore };
}
