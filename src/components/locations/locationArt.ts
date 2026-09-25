import type { Location } from "@/data/locations";
import { MONSTER_COLORS } from "@/components/mascots/monsterColors";

/**
 * Each store's own monster colour — the map pins (idea 9), the location
 * pages and the careers lineup all read it from here so a store is the same
 * colour everywhere it appears. Falls back to red for any id not listed yet.
 * Body and iris are the artist's pairs (`MONSTER_COLORS`).
 */
const COLOR: Partial<Record<Location["id"], keyof typeof MONSTER_COLORS>> = {
  hollywood: "red",
  glendale: "yellow",
  vannuys: "blue",
};

export function locationMonster(id: Location["id"]): { body: string; iris: string } {
  const { body, iris } = MONSTER_COLORS[COLOR[id] ?? "red"];
  return { body, iris };
}
