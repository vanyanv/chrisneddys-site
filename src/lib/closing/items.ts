/**
 * Owner-editable checklist items. Items are ordered by `position` within the
 * store; a section's place in the list is where it first appears by position,
 * so listing = sections in order of first appearance, items by position inside.
 */
import { and, asc, eq, isNull, max } from "drizzle-orm";
import type { Db } from "@/db/client";
import { closingItems } from "@/db/schema";

export type ClosingItem = typeof closingItems.$inferSelect;
export type ItemInput = {
  section: string;
  label: string;
  labelEs?: string | null;
  detail?: string | null;
  detailEs?: string | null;
  kind?: "check" | "temp";
  maxValue?: number | null;
};

function orderBySection(rows: ClosingItem[]): ClosingItem[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const order: string[] = [];
  for (const r of sorted) if (!order.includes(r.section)) order.push(r.section);
  return sorted.sort(
    (a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.position - b.position,
  );
}

export async function listItems(
  db: Db,
  store: string,
  opts: { includeRetired?: boolean } = {},
): Promise<ClosingItem[]> {
  const rows = await db
    .select()
    .from(closingItems)
    .where(
      opts.includeRetired
        ? eq(closingItems.store, store)
        : and(eq(closingItems.store, store), isNull(closingItems.retiredAt)),
    )
    .orderBy(asc(closingItems.position));
  return orderBySection(rows);
}

export async function createItem(db: Db, store: string, input: ItemInput): Promise<ClosingItem> {
  const [m] = await db
    .select({ p: max(closingItems.position) })
    .from(closingItems)
    .where(eq(closingItems.store, store));
  const [row] = await db
    .insert(closingItems)
    .values({ ...input, store, position: (m?.p ?? -1) + 1 })
    .returning();
  return row!;
}

export async function updateItem(
  db: Db,
  id: string,
  patch: Partial<ItemInput>,
): Promise<ClosingItem | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(closingItems).where(eq(closingItems.id, id));
    if (!current) return null;
    const [row] = await tx
      .update(closingItems)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(closingItems.id, id))
      .returning();
    if (!patch.section || patch.section === current.section) return row ?? null;

    // Moved to another section: park it right after the last live item of the
    // target section (end of the list if the section is new) and resequence,
    // so editing never reorders the sections themselves.
    const all = await tx
      .select()
      .from(closingItems)
      .where(eq(closingItems.store, current.store))
      .orderBy(asc(closingItems.position));
    const rest = all.filter((i) => i.id !== id);
    let after = -1;
    rest.forEach((i, at) => {
      if (i.section === patch.section && !i.retiredAt) after = at;
    });
    const ordered = [...rest];
    ordered.splice(after < 0 ? ordered.length : after + 1, 0, row!);
    for (const [position, item] of ordered.entries()) {
      if (item.position !== position) {
        await tx.update(closingItems).set({ position }).where(eq(closingItems.id, item.id));
      }
    }
    return { ...row!, position: ordered.findIndex((i) => i.id === id) };
  });
}

/** Swaps positions with the neighbouring live item in the same section. */
export async function moveItem(db: Db, id: string, direction: "up" | "down"): Promise<void> {
  const [item] = await db.select().from(closingItems).where(eq(closingItems.id, id));
  if (!item || item.retiredAt) return;
  const siblings = (await listItems(db, item.store)).filter((i) => i.section === item.section);
  const at = siblings.findIndex((i) => i.id === id);
  const other = siblings[direction === "up" ? at - 1 : at + 1];
  if (!other) return;
  await db.transaction(async (tx) => {
    await tx.update(closingItems).set({ position: other.position }).where(eq(closingItems.id, id));
    await tx
      .update(closingItems)
      .set({ position: item.position })
      .where(eq(closingItems.id, other.id));
  });
}

export async function retireItem(db: Db, id: string, now: Date = new Date()): Promise<void> {
  await db
    .update(closingItems)
    .set({ retiredAt: now, updatedAt: now })
    .where(eq(closingItems.id, id));
}

export async function restoreItem(db: Db, id: string): Promise<void> {
  await db
    .update(closingItems)
    .set({ retiredAt: null, updatedAt: new Date() })
    .where(eq(closingItems.id, id));
}
