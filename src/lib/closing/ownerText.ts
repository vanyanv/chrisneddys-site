/** Pure helpers for the owner's closing pages: labels, dots, form checking. */
import type { Check, CheckItem, HistoryNight, ItemStats, NightCell } from "./checks";
import type { ItemInput } from "./items";

/** The one store the owner pages manage for now. */
export const CLOSING_STORE = "vannuys";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue Oct 6" from a `YYYY-MM-DD` business date. */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const x = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[x.getUTCDay()]} ${MONTHS[m - 1]} ${d}`;
}

function overTemp(ci: CheckItem): boolean {
  if (ci.kind !== "temp" || !ci.done || ci.maxValue === null) return false;
  const n = ci.value === null || ci.value.trim() === "" ? NaN : Number(ci.value);
  return Number.isFinite(n) && n > ci.maxValue;
}

/** How a submitted check came out: items not done, and temperatures over the limit. */
export function checkSummary(check: Check): { missed: CheckItem[]; over: CheckItem[] } {
  return {
    missed: check.items.filter((i) => !i.done),
    over: check.items.filter(overTemp),
  };
}

export type NightPill = { tone: "ok" | "miss" | "over" | "none" | "wait"; text: string };

/** The pill on a night: "All done", "2 missed", "Over temp", "No check" or "Not yet". */
export function nightPill(night: HistoryNight): NightPill {
  if (!night.check) {
    return night.windowEnded
      ? { tone: "none", text: "No check" }
      : { tone: "wait", text: "Not yet" };
  }
  const { missed, over } = checkSummary(night.check);
  if (missed.length > 0) return { tone: "miss", text: `${missed.length} missed` };
  if (over.length > 0) return { tone: "over", text: "Over temp" };
  return { tone: "ok", text: "All done" };
}

/** The label on a check line as it was sent (Spanish when the crew used Spanish and it exists). */
export function sentLabel(check: Pick<Check, "lang">, item: Pick<CheckItem, "label" | "labelEs">) {
  return check.lang === "es" && item.labelEs ? item.labelEs : item.label;
}

/** The latest night worth showing as a result: one with a check, or whose window is over. */
export function latestResolved(nights: HistoryNight[]): HistoryNight | null {
  return nights.find((n) => n.check || n.windowEnded) ?? null;
}

const CELL_WORD: Record<NightCell, string> = {
  done: "done",
  missed: "missed",
  over: "over temperature",
  none: "no check",
};

/** Accessible text for a dot: "Tue Oct 6: missed". */
export function dotLabel(date: string, cell: NightCell): string {
  return `${dateLabel(date)}: ${CELL_WORD[cell]}`;
}

/** "5 in a row", "missed last time" and friends, from an item's newest-first sequence. */
export function streakCaption(stats: Pick<ItemStats, "sequence" | "streak">): string {
  const last = stats.sequence.find((c) => c !== "none");
  if (!last) return "No checks yet";
  if (last === "missed") return "missed last time";
  if (last === "over") return "over temperature last time";
  return `${stats.streak} in a row`;
}

/** Live items, most missed first; ties keep the checklist's own order. */
export function rankByMissed(stats: ItemStats[]): ItemStats[] {
  return stats
    .map((s, at) => ({ s, at }))
    .sort((a, b) => b.s.missed - a.s.missed || a.at - b.at)
    .map((x) => x.s);
}

/** "Temp ≤ 41°F" tag for a temperature item, else null. */
export function tempTag(item: { kind: "check" | "temp"; maxValue: number | null }): string | null {
  if (item.kind !== "temp") return null;
  return item.maxValue === null ? "Temp" : `Temp ≤ ${item.maxValue}°F`;
}

// ---------------------------------------------------------------- item form

export const NEW_AREA = "__new";
const DEFAULT_MAX_TEMP = 41;

export type ItemFormResult =
  | { ok: true; input: ItemInput }
  | { ok: false; fieldErrors: Record<string, string> };

type Field = (name: string) => string;

/**
 * Checks the item editor's fields. `existingAreas` lets a typed area name that
 * only differs in case reuse the existing spelling.
 */
export function parseItemForm(get: Field, existingAreas: string[]): ItemFormResult {
  const fieldErrors: Record<string, string> = {};
  const text = (name: string) => get(name).trim();

  const label = text("label");
  if (!label) fieldErrors.label = "Type what the crew should see.";
  else if (label.length > 120) fieldErrors.label = "Keep this under 120 characters.";

  const detail = text("detail");
  const labelEs = text("labelEs");
  const detailEs = text("detailEs");
  for (const [name, value] of [
    ["detail", detail],
    ["detailEs", detailEs],
    ["labelEs", labelEs],
  ] as const) {
    if (value.length > 160) fieldErrors[name] = "Keep this under 160 characters.";
  }

  let section = text("section");
  if (section === NEW_AREA) {
    section = text("newSection");
    if (!section) fieldErrors.newSection = "Type a name for the new area.";
  } else if (!section) {
    fieldErrors.section = "Pick an area.";
  }
  if (section.length > 40) fieldErrors.newSection = "Keep the area name under 40 characters.";
  section = existingAreas.find((a) => a.toLowerCase() === section.toLowerCase()) ?? section;

  const kind = text("kind") === "temp" ? "temp" : "check";
  let maxValue: number | null = null;
  if (kind === "temp") {
    const raw = text("maxValue");
    maxValue = raw === "" ? DEFAULT_MAX_TEMP : Number(raw);
    if (!Number.isInteger(maxValue) || maxValue < -20 || maxValue > 99) {
      fieldErrors.maxValue = "Enter a whole number from -20 to 99, like 41.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    input: {
      section,
      label,
      labelEs: labelEs || null,
      detail: detail || null,
      detailEs: detailEs || null,
      kind,
      maxValue,
    },
  };
}

// ----------------------------------------------------------- status messages

const ITEM_DONE: Record<string, string> = {
  saved: "Saved. The crew page has it now.",
  added: "Added to the crew list.",
  retired: "Retired. Gone from the crew list, kept in history.",
  restored: "Restored. It's back on the crew list.",
  up: "Moved up.",
  down: "Moved down.",
  first: "Already first in its area.",
  last: "Already last in its area.",
  gone: "That item no longer exists.",
};

export function itemStatus(done: string | undefined): string | null {
  return (done && ITEM_DONE[done]) || null;
}

/** Status line after a crew or link action, from the action name and the person it was about. */
export function crewStatus(
  done: string | undefined,
  person: { name: string; code: string } | null,
): string | null {
  switch (done) {
    case "added":
      return person ? `${person.name}'s code is ${person.code}.` : null;
    case "newcode":
      return person ? `${person.name}'s new code is ${person.code}.` : null;
    case "off":
      return person ? `${person.name}'s code no longer works.` : null;
    case "on":
      return person ? `${person.name} is back on, new code ${person.code}.` : null;
    case "link":
      return "New link made. Print the new sign.";
    default:
      return null;
  }
}
