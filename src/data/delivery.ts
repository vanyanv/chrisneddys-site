/**
 * The third-party platforms that carry each open location.
 *
 * The Hollywood links were opened in a real browser and confirmed to resolve
 * to the 5539 W. Sunset Blvd store on 2026-09-09. The Van Nuys DoorDash and
 * Uber Eats links came from the owner on 2026-09-26; Van Nuys has no Grubhub
 * listing yet. They are hard to check from a
 * script — DoorDash, Uber Eats and ezCater all answer a plain `curl` with 403 —
 * so `scripts/check-order-links.mjs` reports them as NEEDS-EYES rather than
 * pretending a bot block is a broken link.
 *
 * Ordering direct on Otter is cheaper for the guest and keeps the margin here,
 * which is why the site leads with pickup and lists these underneath rather
 * than beside it.
 */

export type DeliveryPlatform = {
  id: string;
  /** The `Location.id` this listing delivers from. */
  locationId: string;
  /** As the platform brands itself, since that is what people scan for. */
  name: string;
  url: string;
  /** Shown under the name. Kept to a few words — this is a list, not a review. */
  note: string;
};

export const deliveryPlatforms: DeliveryPlatform[] = [
  {
    id: "doordash",
    locationId: "hollywood",
    name: "DoorDash",
    url: "https://www.doordash.com/store/chris-n-eddy-s-los-angeles-2355823/",
    note: "Delivery and pickup",
  },
  {
    id: "ubereats",
    locationId: "hollywood",
    name: "Uber Eats",
    url: "https://www.ubereats.com/store/chris-n-eddys/oiBfIZgIT5CUUrK2rskqCw",
    note: "Delivery and pickup",
  },
  {
    id: "grubhub",
    locationId: "hollywood",
    name: "Grubhub",
    url: "https://www.grubhub.com/restaurant/chris-n-eddys-5539-sunset-blvd-los-angeles/2644852",
    note: "Delivery and pickup",
  },
  {
    id: "doordash",
    locationId: "vannuys",
    name: "DoorDash",
    url: "https://www.doordash.com/store/chris-n-eddy's-van-nuys-51582577/120422181/",
    note: "Delivery and pickup",
  },
  {
    id: "ubereats",
    locationId: "vannuys",
    name: "Uber Eats",
    url: "https://www.ubereats.com/store/chris-n-eddys-van-nuys/8U9YliDbUAKGrX3hQBjbPw",
    note: "Delivery and pickup",
  },
];

/** The delivery listings for one location, in the order above. */
export function deliveryFor(locationId: string): DeliveryPlatform[] {
  return deliveryPlatforms.filter((p) => p.locationId === locationId);
}

/** Large orders and events. A different job from a slider at midnight. */
export const cateringPlatform: DeliveryPlatform = {
  id: "ezcater",
  locationId: "hollywood",
  name: "ezCater",
  url: "https://www.ezcater.com/catering/chris-n-eddys-3",
  note: "Office and event catering",
};

/** The hosts the click tracker recognises, mapped to the platform they belong to. */
export const platformByHost: Record<string, string> = {
  "www.doordash.com": "doordash",
  "doordash.com": "doordash",
  "www.ubereats.com": "ubereats",
  "ubereats.com": "ubereats",
  "www.grubhub.com": "grubhub",
  "grubhub.com": "grubhub",
  "www.ezcater.com": "ezcater",
  "ezcater.com": "ezcater",
};
