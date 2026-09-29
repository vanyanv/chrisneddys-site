/**
 * Lead time, 30-minute slots and day status, all in America/Los_Angeles.
 */
import type { CateringStoreId } from "./stores";
import type { CateringHours, DayStatus, DaysOff, Weekday } from "./types";
import { addMinutes, laDateString, weekdayOf, zonedTimeToUtcMs } from "./timezone";

/** The default notice, and what the owner's "Notice (hours)" setting
 * (`catering_settings.lead_hours`) starts at. One rule for every order,
 * whatever its size. */
export const DEFAULT_LEAD_HOURS = 48;
const SLOT_MINUTES = 30;
export const READY_BY_MINUTES_BEFORE = 30;
export const DRIVER_LEAVES_MINUTES_BEFORE = 20;

/** The earliest UTC instant (ms) an order may be booked for: `leadHours`
 * (default 48) from now, whatever the size of the order. */
export function earliestAllowed(nowMs: number, leadHours: number = DEFAULT_LEAD_HOURS): number {
  return addMinutes(nowMs, leadHours * 60);
}

function isDayOff(dateStr: string, storeId: CateringStoreId, daysOff: DaysOff): boolean {
  if (daysOff.all.includes(dateStr)) return true;
  return (daysOff.byStore[storeId] ?? []).includes(dateStr);
}

function scheduleFor(hours: CateringHours, storeId: CateringStoreId, weekday: Weekday) {
  return hours[storeId]?.[weekday];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Every 30-minute slot on `dateStr` at `storeId` whose start is at or after
 * the lead-time cutoff. Empty when the store is closed,
 * the day is off, or every slot on an open day falls before the cutoff.
 */
export function slotsForDate(
  dateStr: string,
  storeId: CateringStoreId,
  hours: CateringHours,
  daysOff: DaysOff,
  nowMs: number,
  leadHours: number = DEFAULT_LEAD_HOURS,
): string[] {
  if (isDayOff(dateStr, storeId, daysOff)) return [];
  const weekday = weekdayOf(dateStr) as Weekday;
  const day = scheduleFor(hours, storeId, weekday);
  if (!day || day.closed) return [];

  const earliest = earliestAllowed(nowMs, leadHours);
  const slots: string[] = [];
  for (const window of day.windows) {
    const openMin = toMinutes(window.open);
    const closeMin = toMinutes(window.close);
    for (let m = openMin; m <= closeMin; m += SLOT_MINUTES) {
      const hhmm = minutesToHHMM(m);
      const slotMs = zonedTimeToUtcMs(dateStr, hhmm);
      if (slotMs >= earliest) slots.push(hhmm);
    }
  }
  return slots;
}

/**
 * Whether `dateStr` can be picked at all for `storeId`: a past calendar day,
 * a day the store's hours don't cover (closed or a day off), a day that's
 * open but every slot is inside the lead-time window ("too-soon"), or open.
 */
export function dayStatus(
  dateStr: string,
  storeId: CateringStoreId,
  hours: CateringHours,
  daysOff: DaysOff,
  nowMs: number,
  leadHours: number = DEFAULT_LEAD_HOURS,
): DayStatus {
  const today = laDateString(nowMs);
  if (dateStr < today) return "past";

  if (isDayOff(dateStr, storeId, daysOff)) return "closed";
  const weekday = weekdayOf(dateStr) as Weekday;
  const day = scheduleFor(hours, storeId, weekday);
  if (!day || day.closed) return "closed";

  const slots = slotsForDate(dateStr, storeId, hours, daysOff, nowMs, leadHours);
  return slots.length > 0 ? "open" : "too-soon";
}

/** The UTC instant (ms) for a "YYYY-MM-DD" + "HH:MM" slot at `storeId`. */
export function slotToUtcMs(dateStr: string, timeStr: string): number {
  return zonedTimeToUtcMs(dateStr, timeStr);
}

/** When the food should be ready: 30 minutes before the slot. */
export function readyByMs(slotMs: number): number {
  return addMinutes(slotMs, -READY_BY_MINUTES_BEFORE);
}

/** When the driver should leave for a delivery: 20 minutes before the slot. */
export function driverLeavesMs(slotMs: number): number {
  return addMinutes(slotMs, -DRIVER_LEAVES_MINUTES_BEFORE);
}
