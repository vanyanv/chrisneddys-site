import { locations, type Location } from "@/data/locations";
import { deliveryFor } from "@/data/delivery";
import { closingSummary, hoursSentence } from "@/lib/hours";

/**
 * Copy that speaks for every open location instead of naming one.
 *
 * The site was written when Hollywood was the only store, so sitewide lines
 * said "the Hollywood location" where they meant "us". These build the same
 * sentences from whichever stores are open right now. They read `isOpen`
 * through the getters in `locations.ts`, so a store that opens later joins
 * the sentence by itself (issue #178).
 */

/** The stores taking orders right now, in `locations` order. */
export function openLocations(): Location[] {
  return locations.filter((loc) => loc.isOpen);
}

/** "Hollywood", "Hollywood and Van Nuys", "Hollywood, Van Nuys and Glendale". */
export function joinNames(names: string[], conjunction: "and" | "or" = "and"): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`;
}

/** The open stores' names as one phrase: "Hollywood and Van Nuys". */
export function openNames(conjunction: "and" | "or" = "and"): string {
  return joinNames(
    openLocations().map((loc) => loc.neighbourhood),
    conjunction,
  );
}

/**
 * `read(loc)` when every open store gives the same answer, else null. Hours
 * are identical at every store today; this keeps a sentence honest the day
 * they are not.
 */
function shared(read: (loc: Location) => string): string | null {
  const values = openLocations().map(read);
  return values.length > 0 && values.every((v) => v === values[0]) ? values[0]! : null;
}

/** Subject and verb for a sentence about every open store. */
function allOpen(): string {
  const open = openLocations();
  if (open.length === 1) return `The ${open[0]!.neighbourhood} location is`;
  return `${openNames()} are ${open.length === 2 ? "both" : "all"}`;
}

/** "Late. Hollywood and Van Nuys are both open 10 AM to 1 AM Monday to Thursday, …" */
export function openHoursAnswer(): string {
  const same = shared(hoursSentence);
  if (same) return `Late. ${allOpen()} open ${same}.`;
  return `Late. ${openLocations()
    .map((loc) => `${loc.neighbourhood} is open ${hoursSentence(loc)}`)
    .join("; ")}.`;
}

/** "Hollywood and Van Nuys both serve until 1 AM Monday to Thursday, …" */
export function closingLine(): string {
  const open = openLocations();
  const same = shared(closingSummary);
  if (same) {
    return open.length === 1
      ? `The ${open[0]!.neighbourhood} location serves until ${same}`
      : `${openNames()} ${open.length === 2 ? "both" : "all"} serve until ${same}`;
  }
  return open.map((loc) => `${loc.neighbourhood} serves until ${closingSummary(loc)}`).join("; ");
}

/**
 * "DoorDash and Uber Eats deliver from Hollywood and Van Nuys, and Grubhub
 * from Hollywood" — each app named once, with the stores it carries.
 */
export function deliverySentence(): string {
  const byApp = new Map<string, string[]>();
  for (const loc of openLocations()) {
    for (const app of deliveryFor(loc.id)) {
      byApp.set(app.name, [...(byApp.get(app.name) ?? []), loc.neighbourhood]);
    }
  }
  // Apps that carry the same stores share one clause.
  const clauses = new Map<string, string[]>();
  for (const [app, stores] of byApp) {
    const key = joinNames(stores);
    clauses.set(key, [...(clauses.get(key) ?? []), app]);
  }
  const parts = [...clauses].map(([stores, apps], i) => {
    const verb = i === 0 ? (apps.length === 1 ? " delivers" : " deliver") : "";
    return `${joinNames(apps)}${verb} from ${stores}`;
  });
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** "Hollywood (323) 544-3600, Van Nuys (818) 208-9315" */
export function phoneList(): string {
  return openLocations()
    .filter((loc) => loc.phone)
    .map((loc) => `${loc.neighbourhood} ${loc.phone}`)
    .join(", ");
}
