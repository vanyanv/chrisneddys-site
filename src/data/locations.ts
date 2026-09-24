import { brand } from "./brand";

export type Location = {
  id: "hollywood" | "glendale" | "vannuys";
  name: string;
  /** The neighbourhood people actually search, which isn't always `city`. */
  neighbourhood: string;
  sub: string;
  /**
   * The line this location answers itself. A store only gets a CALL button and a
   * `telephone` in its JSON-LD once it has one — three addresses across two
   * cities sharing the Hollywood number is the pattern local search reads as a
   * virtual office. Glendale and Van Nuys get theirs when they open.
   */
  phone?: string;
  phoneTel?: string;
  address: string;
  city: string;
  region: string;
  postal: string;
  status: string;
  isOpen: boolean;
  /** Public launch copy shown before a dated opening; absent for an undated store. */
  openingAnnouncement?: string;
  /**
   * When a dated store opens its doors (ISO time with the LA offset). Present
   * only until then, so the header tag and bottom bar can say "OPENS FRI 6 PM"
   * on that store's page instead of borrowing Hollywood's clock.
   */
  opensAt?: string;
  /**
   * When a store that has not opened yet starts showing its hours on its own
   * page (ISO time with the LA offset). Before then the page shows only the
   * opening announcement. Owner's call 2026-09-24: Van Nuys shows its hours
   * from the start of its opening day.
   */
  showHoursFrom?: string;
  /**
   * Present once this store has its own Otter pickup storefront. The ORDER
   * button and structured OrderAction are still gated by `isOpen`, so a URL
   * can be staged before launch without inviting premature orders.
   */
  /** This location's direct pickup storefront. Only rendered as an order action once open. */
  orderUrl?: string;
  lat: number;
  lng: number;
  hours: Array<[string, string]>;
  openingSpec?: Array<{ dayOfWeek: string[]; opens: string; closes: string }>;
};

/**
 * Van Nuys' grand opening: Friday, Sept 25 2026 at 6 PM, LA time (owner,
 * 2026-09-24). From this moment the store is open everywhere on the site —
 * its ORDER button, hours, live status, map pin, footer and JSON-LD — with
 * no deploy: the storefront regenerates every minute and reads the clock.
 */
export const VAN_NUYS_OPENS_AT = "2026-09-25T18:00:00-07:00";

/** Whether `at` (an ISO time with offset) has passed. */
export function hasPassed(at: string, now: number = Date.now()): boolean {
  return now >= Date.parse(at);
}

const VAN_NUYS_ANNOUNCEMENT = "Grand opening Friday, Sept 25 at 6 PM";

/**
 * The Van Nuys record. Its opening fields are getters, not values, so every
 * read asks the clock: before `VAN_NUYS_OPENS_AT` it is a dated coming-soon
 * store, from then on an open one with the same hours as Hollywood. Nothing
 * may copy these fields into a module-level constant, or that copy would
 * freeze at whatever time the module loaded.
 */
function vanNuys(): Location {
  const open = () => hasPassed(VAN_NUYS_OPENS_AT);
  return {
    id: "vannuys",
    name: "Van Nuys",
    neighbourhood: "Van Nuys",
    get sub() {
      return open() ? "Now open" : VAN_NUYS_ANNOUNCEMENT;
    },
    address: "14523 Sherman Way",
    city: "Van Nuys",
    region: "CA",
    postal: "91405",
    get status() {
      return open() ? "Open daily" : VAN_NUYS_ANNOUNCEMENT;
    },
    get isOpen() {
      return open();
    },
    get openingAnnouncement() {
      return open() ? undefined : VAN_NUYS_ANNOUNCEMENT;
    },
    get opensAt() {
      return open() ? undefined : VAN_NUYS_OPENS_AT;
    },
    // Opening day itself shows the hours from midnight, ahead of the 6 PM
    // doors (owner, 2026-09-24).
    showHoursFrom: "2026-09-25T00:00:00-07:00",
    phone: "(818) 208-9315",
    phoneTel: "+18182089315",
    orderUrl:
      "https://order.tryotter.com/s/chris-n-eddys/14523-sherman-way%2C-van-nuys%2C-ca-91405%2C-usa-los-angeles/3dff7900-1388-4332-8079-091c3bb96eb4?fulfillment_mode=pickup",
    lat: 34.2011,
    lng: -118.4497,
    hours: [
      ["Mon–Thu", "10:00 AM – 1:00 AM"],
      ["Fri–Sat", "10:00 AM – 2:00 AM"],
      ["Sunday", "10:00 AM – 2:00 AM"],
    ],
    get openingSpec() {
      return open()
        ? [
            {
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
              opens: "10:00",
              closes: "01:00",
            },
            { dayOfWeek: ["Friday", "Saturday", "Sunday"], opens: "10:00", closes: "02:00" },
          ]
        : undefined;
    },
  };
}

export const locations: Location[] = [
  {
    id: "hollywood",
    name: "Hollywood",
    neighbourhood: "Hollywood",
    sub: "Open since 2021",
    address: "5539 W. Sunset Blvd",
    city: "Los Angeles",
    region: "CA",
    postal: "90028",
    status: "Open daily",
    isOpen: true,
    orderUrl: brand.orderUrl,
    phone: brand.phone,
    phoneTel: brand.phoneTel,
    lat: 34.098,
    lng: -118.3099,
    hours: [
      ["Mon–Thu", "10:00 AM – 1:00 AM"],
      ["Fri–Sat", "10:00 AM – 2:00 AM"],
      ["Sunday", "10:00 AM – 2:00 AM"],
    ],
    openingSpec: [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "10:00",
        closes: "01:00",
      },
      { dayOfWeek: ["Friday", "Saturday", "Sunday"], opens: "10:00", closes: "02:00" },
    ],
  },
  {
    id: "glendale",
    name: "Glendale",
    neighbourhood: "Glendale",
    sub: "Opening soon",
    address: "1360 E Colorado St",
    city: "Glendale",
    region: "CA",
    postal: "91205",
    status: "Opening soon",
    isOpen: false,
    lat: 34.1393,
    lng: -118.238,
    hours: [["Launch", "Date to be announced"]],
    // No openingSpec until it opens: it is what the live open/closed pill and
    // the JSON-LD openingHoursSpecification are both built from, and neither
    // should claim hours for a location that is not serving.
  },
  vanNuys(),
];

/**
 * The store that answers `hollywood@`, orders and JSON-LD without a location
 * of its own, and every `find(... "hollywood")` that used to need a fallback
 * for a lookup typed as possibly missing. Hollywood is first above and the
 * array is never empty, so this is safe — kept as a named constant instead of
 * a bare `locations[0]` at each call site.
 */
export const flagship: Location = locations[0]!; // literal array above is non-empty
