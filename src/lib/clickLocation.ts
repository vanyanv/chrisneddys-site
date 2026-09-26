import { locations, type Location } from "@/data/locations";
import { deliveryPlatforms, cateringPlatform } from "@/data/delivery";
import { slugFor } from "@/lib/locationSlug";

/**
 * Which store a tracked click belongs to, as the `location` parameter GA4
 * receives — always the URL slug (`van-nuys`), never the data id (`vannuys`),
 * so one store is one row in a report.
 *
 * The link itself is the most reliable witness. Every Otter storefront URL
 * carries its store's ID (`/s/{brand}/{address}/{storeId}/…`), and each open
 * store has its own phone number, so an ORDER or CALL link says where it goes
 * whichever button, picker or page it sits in — including buttons added later
 * that nobody remembers to label. A `data-location` declared on an ancestor is
 * the fallback for links that don't identify a store on their own (directions).
 * Delivery and catering listings each belong to one store, so they answer from
 * the link too.
 */

const digits = (tel: string) => tel.replace(/\D/g, "");

/** The Otter store ID in a storefront or item URL, if it is one. */
export function otterStoreId(url: URL): string | undefined {
  if (url.hostname !== "order.tryotter.com") return undefined;
  const [, s, , , storeId] = url.pathname.split("/");
  return s === "s" && storeId ? storeId : undefined;
}

const byOtterStore = new Map<string, string>();
const byPhone = new Map<string, string>();
const phoneCounts = new Map<string, number>();

for (const loc of locations) {
  if (loc.orderUrl) {
    const id = otterStoreId(new URL(loc.orderUrl));
    if (id) byOtterStore.set(id, slugFor(loc));
  }
  if (loc.phoneTel) {
    const d = digits(loc.phoneTel);
    phoneCounts.set(d, (phoneCounts.get(d) ?? 0) + 1);
    byPhone.set(d, slugFor(loc));
  }
}
// A number shared by two stores can't say which one was rung.
for (const [d, n] of phoneCounts) if (n > 1) byPhone.delete(d);

const slugById = new Map<string, string>(locations.map((l) => [l.id, slugFor(l)]));

/** A listing URL without its query, hash or trailing slash, so a tagged or
 * re-typed copy of the same link still matches. */
const listingKey = (url: URL) => `${url.hostname}${url.pathname.replace(/\/+$/, "")}`;

// Each delivery and catering listing belongs to one store, so the link says
// where it goes the way an Otter link does.
const byListing = new Map<string, string>();
for (const p of [...deliveryPlatforms, cateringPlatform]) {
  const slug = slugById.get(p.locationId as Location["id"]);
  if (slug) byListing.set(listingKey(new URL(p.url)), slug);
}

/** A declared `data-location`, in slug form whichever spelling was used. */
export function normaliseLocation(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return slugById.get(value as Location["id"]) ?? value;
}

/**
 * The store for a clicked link: from the link when it names one (an Otter
 * store, a store's own number), otherwise from the declared ancestor.
 */
export function clickLocation(href: string, declared?: string): string | undefined {
  if (href.startsWith("tel:")) {
    return byPhone.get(digits(href.slice(4))) ?? normaliseLocation(declared);
  }
  let fromLink: string | undefined;
  try {
    const url = new URL(href);
    const id = otterStoreId(url);
    fromLink = id ? byOtterStore.get(id) : byListing.get(listingKey(url));
  } catch {
    /* relative or malformed: nothing to read */
  }
  return fromLink ?? normaliseLocation(declared);
}
