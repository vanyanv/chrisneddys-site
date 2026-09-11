/**
 * The third-party platforms that carry the Hollywood location.
 *
 * Every one of these was opened in a real browser and confirmed to resolve to
 * the 5539 W. Sunset Blvd store on 2026-09-09. They are hard to check from a
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
  /** As the platform brands itself, since that is what people scan for. */
  name: string;
  url: string;
  /** Shown under the name. Kept to a few words — this is a list, not a review. */
  note: string;
};

export const deliveryPlatforms: DeliveryPlatform[] = [
  {
    id: "doordash",
    name: "DoorDash",
    url: "https://www.doordash.com/store/chris-n-eddy-s-los-angeles-2355823/",
    note: "Delivery and pickup",
  },
  {
    id: "ubereats",
    name: "Uber Eats",
    url: "https://www.ubereats.com/store/chris-n-eddys/oiBfIZgIT5CUUrK2rskqCw",
    note: "Delivery and pickup",
  },
  {
    id: "grubhub",
    name: "Grubhub",
    url: "https://www.grubhub.com/restaurant/chris-n-eddys-5539-sunset-blvd-los-angeles/2644852",
    note: "Delivery and pickup",
  },
];

/** Large orders and events. A different job from a slider at midnight. */
export const cateringPlatform: DeliveryPlatform = {
  id: "ezcater",
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
