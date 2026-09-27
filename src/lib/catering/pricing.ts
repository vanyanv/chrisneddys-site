/**
 * Line pricing, line merging, line validation, and the order quote — food,
 * tax, delivery, tip. All money is integer cents.
 */
import { allItems, itemById, toppings, type WayId } from "@/data/menu";
import { EXTRAS, extraById, resolveWay, toppingById, wayLabel } from "./menu-adapter";
import type { CartLine, Freebies, PricedLine, Quote, QuoteInput } from "./types";

const TAX_RATE_BPS = 975; // 9.75%, out of 10,000
const DEFAULT_TIP_PERCENT = 10;

export const MAX_QTY = 999;
export const MAX_NAME_LENGTH = 40;
export const MAX_NOTE_LENGTH = 140;

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** The menu price plus any paid extras on the line, per unit, in cents. */
export function unitPriceCents(line: Pick<CartLine, "itemId" | "extras">): number {
  const item = itemById(line.itemId);
  const base = item ? dollarsToCents(item.price) : 0;
  const extrasCents = line.extras.reduce((sum, id) => {
    const extra = extraById(id);
    return sum + (extra ? dollarsToCents(extra.price) : 0);
  }, 0);
  return base + extrasCents;
}

/** The line's total, `unitPriceCents(line) * qty`, in cents. */
export function lineAmountCents(line: Pick<CartLine, "itemId" | "extras" | "qty">): number {
  return unitPriceCents(line) * line.qty;
}

function normName(name: string | undefined): string {
  return (name ?? "").trim();
}

function normNote(note: string | undefined): string {
  return (note ?? "").trim();
}

/**
 * The key two lines must share to merge in the cart: same item, same way,
 * the same toppings and extras (order ignored), and the same "for" name and
 * note (trimmed) — a blank name/note and an absent one merge together.
 */
export function lineKey(line: CartLine): string {
  const toppingIds = [...line.toppings].sort().join(",");
  const extraIds = [...line.extras].sort().join(",");
  return [
    line.itemId,
    line.wayId ?? "",
    toppingIds,
    extraIds,
    normName(line.forName),
    normNote(line.note),
  ].join("|");
}

export type LineValidationError =
  | "unknown-item"
  | "unknown-way"
  | "unknown-topping"
  | "unknown-extra"
  | "toppings-not-allowed"
  | "extras-not-allowed"
  | "invalid-qty"
  | "name-too-long"
  | "note-too-long";

export type LineValidationResult = { ok: true } | { ok: false; errors: LineValidationError[] };

/** Strips ASCII/C1 control characters (kept out of names and notes). */
export function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
}

/**
 * Checks a line against the menu: the item, way, toppings and extras all
 * exist; toppings/extras are only ever set on an item that takes them;
 * quantity is 1–999; name and note fit their limits once control characters
 * are stripped and the string is trimmed.
 */
export function validateLine(line: CartLine): LineValidationResult {
  const errors: LineValidationError[] = [];
  const item = itemById(line.itemId);
  if (!item) {
    errors.push("unknown-item");
    return { ok: false, errors };
  }

  if (line.wayId && line.wayId !== "custom") {
    const validWay: WayId[] = ["chris", "eddy"];
    if (!validWay.includes(line.wayId)) errors.push("unknown-way");
  }

  const hasToppings = line.toppings.length > 0;
  const hasExtras = line.extras.length > 0;
  if (!item.takesToppings && (hasToppings || line.wayId)) {
    errors.push("toppings-not-allowed");
  }
  if (!item.takesToppings && hasExtras) {
    errors.push("extras-not-allowed");
  }
  for (const id of line.toppings) {
    if (!toppingById(id)) errors.push("unknown-topping");
  }
  for (const id of line.extras) {
    if (!extraById(id)) errors.push("unknown-extra");
  }

  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) {
    errors.push("invalid-qty");
  }

  const name = stripControlChars(normName(line.forName));
  if (name.length > MAX_NAME_LENGTH) errors.push("name-too-long");
  const note = stripControlChars(normNote(line.note));
  if (note.length > MAX_NOTE_LENGTH) errors.push("note-too-long");

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export type LineDescription = {
  wayLabel: string | null;
  toppingLabels: string[];
  extraLabels: string[];
};

/** Human labels for a line's way, toppings and extras, for tickets and invoices. */
export function describeLine(
  line: Pick<CartLine, "wayId" | "toppings" | "extras">,
): LineDescription {
  const way = line.wayId && line.wayId !== "custom" ? wayLabel(line.wayId) : null;
  const toppingLabels = line.toppings
    .map((id) => toppingById(id)?.name)
    .filter((n): n is NonNullable<typeof n> => n != null);
  const extraLabels = line.extras
    .map((id) => extraById(id)?.name)
    .filter((n): n is NonNullable<typeof n> => n != null);
  return { wayLabel: way, toppingLabels, extraLabels };
}

/** `resolveWay`, re-exported here since pricing/validation is where callers reach for it. */
export { resolveWay };

function priceLine(line: CartLine): PricedLine {
  const unitCents = unitPriceCents(line);
  return { ...line, unitCents, amountCents: unitCents * line.qty };
}

function roundHalfUpTax(foodCents: number): number {
  // Integer math: foodCents * 975 stays well inside Number.MAX_SAFE_INTEGER
  // for any realistic order total, so this never loses precision the way
  // `foodCents * 0.0975` can right at a .5-cent boundary.
  return Math.floor((foodCents * TAX_RATE_BPS + 5000) / 10000);
}

function resolveTipCents(foodCents: number, tip: QuoteInput["tip"]): number {
  if (!tip) return Math.round((foodCents * DEFAULT_TIP_PERCENT) / 100);
  if ("tipCents" in tip) return Math.max(0, Math.round(tip.tipCents));
  return Math.max(0, Math.round((foodCents * tip.tipPercent) / 100));
}

const DEFAULT_FREEBIES: Freebies = { plates: 0, napkins: 0, utensils: 0 };

/**
 * Prices a cart: each line, the food subtotal, tax (9.75% on food only),
 * delivery (flat, pickup orders get none), and tip (10% of food by
 * default). Plates/napkins/utensils are counted, never priced.
 */
export function quote(lines: CartLine[], input: QuoteInput): Quote {
  const priced = lines.map(priceLine);
  const foodCents = priced.reduce((sum, l) => sum + l.amountCents, 0);
  const deliveryCents = input.fulfilment === "delivery" ? (input.deliveryFeeCents ?? 0) : 0;
  const taxCents = roundHalfUpTax(foodCents);
  const tipCents = resolveTipCents(foodCents, input.tip);
  const totalCents = foodCents + deliveryCents + taxCents + tipCents;
  const freebies: Freebies = { ...DEFAULT_FREEBIES, ...input.freebies };
  return { lines: priced, foodCents, deliveryCents, taxCents, tipCents, totalCents, freebies };
}

// Re-exported for convenience so callers of this module don't also need to
// import straight from `src/data/menu.ts` or `menu-adapter.ts` for the ids
// that back toppings/extras validation UI.
export { allItems, toppings, EXTRAS };
