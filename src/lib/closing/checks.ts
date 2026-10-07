/** Submitting a night's checklist, reading it back, and the owner's history. */
import { asc, eq, and, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { closingCheckItems, closingChecks, closingStores } from "@/db/schema";
import { locations } from "@/data/locations";
import { businessDate, closingWindow, recentBusinessDates, windowState } from "./night";
import { listItems, type ClosingItem } from "./items";
import type { CrewMember } from "./crew";

export type CheckItem = typeof closingCheckItems.$inferSelect;
export type Check = typeof closingChecks.$inferSelect & { items: CheckItem[] };

export type Answer = { itemId: string; done: boolean; value?: string | null };

export type SubmitResult =
  | { status: "sent"; check: Check }
  | { status: "already"; check: Check }
  | { status: "closed"; reason: "before" | "after" | "no_service" };

async function withItems(db: Db, row: typeof closingChecks.$inferSelect): Promise<Check> {
  const items = await db
    .select()
    .from(closingCheckItems)
    .where(eq(closingCheckItems.checkId, row.id))
    .orderBy(asc(closingCheckItems.position));
  return { ...row, items };
}

export async function getCheckForNight(db: Db, store: string, date: string): Promise<Check | null> {
  const [row] = await db
    .select()
    .from(closingChecks)
    .where(and(eq(closingChecks.store, store), eq(closingChecks.businessDate, date)));
  return row ? withItems(db, row) : null;
}

async function windowFor(db: Db, store: string, date: string) {
  const loc = locations.find((l) => l.id === store);
  const [cfg] = await db.select().from(closingStores).where(eq(closingStores.store, store));
  if (!loc || !cfg) return null;
  return closingWindow(loc, date, { opensBeforeMin: cfg.opensBeforeMin, graceMin: cfg.graceMin });
}

/**
 * Records tonight's checklist. The window is recomputed here from the server
 * clock; only live items are snapshotted (unknown ids ignored, unanswered =
 * not done). One check per store per business night: the unique constraint
 * decides races, and the loser gets `already` with the winner's check.
 */
export async function submitCheck(
  db: Db,
  input: {
    store: string;
    crew: Pick<CrewMember, "id" | "name">;
    answers: Answer[];
    note?: string | null;
    lang: string;
    now: Date;
  },
): Promise<SubmitResult> {
  const { store, crew, answers, now } = input;
  const date = businessDate(now);
  const window = await windowFor(db, store, date);
  if (!window) return { status: "closed", reason: "no_service" };
  const state = windowState(now, window);
  if (state !== "open") return { status: "closed", reason: state };

  const live = await listItems(db, store);
  const byId = new Map(answers.map((a) => [a.itemId, a]));
  const note = input.note?.trim() || null;

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(closingChecks)
      .values({
        store,
        businessDate: date,
        crewId: crew.id,
        crewName: crew.name,
        lang: input.lang,
        note,
        submittedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    if (live.length > 0) {
      await tx.insert(closingCheckItems).values(
        live.map((item, position) => {
          const a = byId.get(item.id);
          return {
            checkId: row.id,
            itemId: item.id,
            section: item.section,
            label: item.label,
            labelEs: item.labelEs,
            kind: item.kind,
            maxValue: item.maxValue,
            ...answerFor(item, a),
            position,
          };
        }),
      );
    }
    return row;
  });

  if (inserted) return { status: "sent", check: await withItems(db, inserted) };
  const existing = await getCheckForNight(db, store, date);
  return { status: "already", check: existing! };
}

/** A temp item is done only with a finite numeric reading; otherwise not done, no value. */
function answerFor(
  item: ClosingItem,
  a: Answer | undefined,
): { done: boolean; value: string | null } {
  if (item.kind !== "temp") return { done: a?.done === true, value: null };
  const value = a?.value?.trim() ?? "";
  if (a?.done !== true || value === "" || !Number.isFinite(Number(value))) {
    return { done: false, value: null };
  }
  return { done: true, value };
}

export type NightCell = "done" | "missed" | "over" | "none";
export type HistoryNight = {
  date: string;
  check: Check | null;
  /** True once the night's submit window is over (so no check = "missed"). */
  windowEnded: boolean;
};
export type ItemStats = {
  item: ClosingItem;
  missed: number;
  nightsSeen: number;
  /** Newest first, aligned with `nights`. */
  sequence: NightCell[];
  /** Consecutive done nights ending at the latest night the item was checked. */
  streak: number;
};

function cellFor(check: Check | null, itemId: string): NightCell {
  const ci = check?.items.find((i) => i.itemId === itemId);
  if (!ci) return "none";
  if (!ci.done) return "missed";
  const temp = ci.value === null || ci.value.trim() === "" ? NaN : Number(ci.value);
  if (ci.kind === "temp" && !Number.isFinite(temp)) return "missed";
  return ci.kind === "temp" && ci.maxValue !== null && temp > ci.maxValue ? "over" : "done";
}

export async function ownerHistory(
  db: Db,
  store: string,
  now: Date,
  nights = 14,
): Promise<{ nights: HistoryNight[]; items: ItemStats[] }> {
  const dates = recentBusinessDates(now, nights);
  const rows = await db
    .select()
    .from(closingChecks)
    .where(and(eq(closingChecks.store, store), inArray(closingChecks.businessDate, dates)));
  const checks = new Map<string, Check>();
  for (const r of rows) checks.set(r.businessDate, await withItems(db, r));

  const history: HistoryNight[] = [];
  for (const date of dates) {
    const w = await windowFor(db, store, date);
    history.push({
      date,
      check: checks.get(date) ?? null,
      windowEnded: w ? windowState(now, w) === "after" : true,
    });
  }

  const items = (await listItems(db, store)).map((item): ItemStats => {
    const sequence = history.map((n) => cellFor(n.check, item.id));
    let streak = 0;
    for (const cell of sequence.filter((c) => c !== "none")) {
      if (cell !== "done") break;
      streak++;
    }
    return {
      item,
      missed: sequence.filter((c) => c === "missed").length,
      nightsSeen: sequence.filter((c) => c !== "none").length,
      sequence,
      streak,
    };
  });
  return { nights: history, items };
}
