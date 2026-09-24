import type { Location } from "@/data/locations";

/**
 * Each store's own monster colour — the map pins (idea 9), the location
 * pages and the careers lineup all read it from here so a store is the same
 * colour everywhere it appears. Falls back to red for any id not listed yet.
 * The iris follows the approved demo's pairing: a blue body gets a red iris,
 * everything else a blue one, so the eye never matches the body.
 */
const BODY: Partial<Record<Location["id"], string>> = {
  hollywood: "#e63027",
  glendale: "#f5d20e",
  vannuys: "#2e5fd9",
};

export function locationMonster(id: Location["id"]): { body: string; iris: string } {
  const body = BODY[id] ?? "#e63027";
  return { body, iris: body === "#2e5fd9" ? "#e63027" : "#2e5fd9" };
}
