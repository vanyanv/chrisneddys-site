/**
 * The catering-wide settings singleton (`catering_settings`, `id =
 * "default"`) — on/off, hours per store per weekday, days off, the delivery
 * fee, the delivery range, and the reply/lead-time windows. Same shape as
 * `getStoreSettings`/`updateStoreSettings` in `src/lib/orders.ts`: a
 * get-or-create read and a validate-then-merge write, both taking an
 * optional `db: Db` last.
 */
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import {
  cateringSettings,
  type CateringDayHours,
  type CateringDayOff,
  type CateringHours,
} from "@/db/schema";

async function resolveDb(db: Db | undefined): Promise<Db> {
  return db ?? (await getDb());
}

export type CateringSettings = typeof cateringSettings.$inferSelect;

/** The stores catering hours are kept for — see `docs/catering-build-
 * plan.md`'s "Stores" ground rule. Glendale joins this list, not an `if`,
 * once it opens. */
export const CATERING_STORE_IDS = ["hollywood", "vannuys"] as const;

function defaultHours(): CateringHours {
  const week: Record<string, CateringDayHours[]> = {};
  for (let day = 0; day <= 6; day++) week[String(day)] = [{ open: "10:00", close: "20:00" }];
  return Object.fromEntries(CATERING_STORE_IDS.map((store) => [store, { ...week }]));
}

/** Reads the single `catering_settings` row, creating a bare-default one on
 * the (in practice, seed-only) chance it doesn't exist yet — same
 * get-or-create shape as `getStoreSettings`. */
export async function getCateringSettings(db?: Db): Promise<CateringSettings> {
  const database = await resolveDb(db);
  const existing = await database.query.cateringSettings.findFirst({
    where: eq(cateringSettings.id, "default"),
  });
  if (existing) return existing;

  const [created] = await database
    .insert(cateringSettings)
    .values({ id: "default", hours: defaultHours() })
    .onConflictDoNothing({ target: cateringSettings.id })
    .returning();
  if (created) return created;

  const row = await database.query.cateringSettings.findFirst({
    where: eq(cateringSettings.id, "default"),
  });
  if (!row) throw new Error("catering_settings default row missing and could not be created");
  return row;
}

export type CateringSettingsPatch = Partial<{
  orderingOn: boolean;
  hours: CateringHours;
  daysOff: CateringDayOff[];
  deliveryFeeCents: number;
  rangeMiles: number;
  replyHours: number;
  leadHours: number;
  ownerEmail: string;
}>;

export type SaveCateringSettingsResult =
  | { ok: true; settings: CateringSettings }
  | { ok: false; error: string; field?: keyof CateringSettingsPatch };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DELIVERY_FEE_MAX_CENTS = 20_000;
const RANGE_MILES_MIN = 1;
const RANGE_MILES_MAX = 50;

function isPositiveInt(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

function validateHours(hours: CateringHours): string | undefined {
  for (const [store, week] of Object.entries(hours)) {
    for (const [weekday, slots] of Object.entries(week)) {
      const day = Number(weekday);
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        return `"${store}" has an invalid weekday key "${weekday}" (must be 0–6).`;
      }
      for (const slot of slots) {
        if (!TIME_PATTERN.test(slot.open) || !TIME_PATTERN.test(slot.close)) {
          return `"${store}" weekday ${weekday} has a time that isn't HH:MM.`;
        }
        if (timeToMinutes(slot.open) >= timeToMinutes(slot.close)) {
          return `"${store}" weekday ${weekday}: opening time must be before closing time.`;
        }
      }
    }
  }
  return undefined;
}

function validateDaysOff(daysOff: CateringDayOff[]): string | undefined {
  for (const dayOff of daysOff) {
    if (!DATE_PATTERN.test(dayOff.date)) {
      return `"${dayOff.date}" is not a YYYY-MM-DD date.`;
    }
  }
  return undefined;
}

/** Validates `patch`, then merges it into the single `catering_settings`
 * row — same validate-then-merge shape as `updateStoreSettings`. */
export async function saveCateringSettings(
  patch: CateringSettingsPatch,
  db?: Db,
): Promise<SaveCateringSettingsResult> {
  const database = await resolveDb(db);

  if (patch.hours !== undefined) {
    const error = validateHours(patch.hours);
    if (error) return { ok: false, error, field: "hours" };
  }
  if (patch.daysOff !== undefined) {
    const error = validateDaysOff(patch.daysOff);
    if (error) return { ok: false, error, field: "daysOff" };
  }
  if (
    patch.deliveryFeeCents !== undefined &&
    (!Number.isInteger(patch.deliveryFeeCents) ||
      patch.deliveryFeeCents < 0 ||
      patch.deliveryFeeCents > DELIVERY_FEE_MAX_CENTS)
  ) {
    return {
      ok: false,
      error: `Delivery fee must be between 0 and ${DELIVERY_FEE_MAX_CENTS} cents.`,
      field: "deliveryFeeCents",
    };
  }
  if (
    patch.rangeMiles !== undefined &&
    (!Number.isInteger(patch.rangeMiles) ||
      patch.rangeMiles < RANGE_MILES_MIN ||
      patch.rangeMiles > RANGE_MILES_MAX)
  ) {
    return {
      ok: false,
      error: `Delivery range must be between ${RANGE_MILES_MIN} and ${RANGE_MILES_MAX} miles.`,
      field: "rangeMiles",
    };
  }
  if (patch.replyHours !== undefined && !isPositiveInt(patch.replyHours)) {
    return {
      ok: false,
      error: "Reply hours must be a positive whole number.",
      field: "replyHours",
    };
  }
  if (patch.leadHours !== undefined && !isPositiveInt(patch.leadHours)) {
    return { ok: false, error: "Lead hours must be a positive whole number.", field: "leadHours" };
  }
  if (patch.ownerEmail !== undefined && !EMAIL_PATTERN.test(patch.ownerEmail)) {
    return { ok: false, error: "Owner email is not a valid email address.", field: "ownerEmail" };
  }

  // Ensure the row exists before the update below.
  await getCateringSettings(database);

  const [row] = await database
    .update(cateringSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(cateringSettings.id, "default"))
    .returning();
  if (!row) throw new Error("update of catering_settings returned nothing");
  return { ok: true, settings: row };
}
