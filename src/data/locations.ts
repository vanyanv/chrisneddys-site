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
   * virtual office. Glendale gets its own when it opens.
   */
  phone?: string;
  phoneTel?: string;
  address: string;
  city: string;
  region: string;
  postal: string;
  status: string;
  isOpen: boolean;
  /**
   * Present once this store has its own Otter pickup storefront. The ORDER
   * button and structured OrderAction are still gated by `isOpen`, so a URL
   * can be staged before launch without inviting premature orders.
   */
  /** This location's direct pickup storefront. Only rendered as an order action once open. */
  orderUrl?: string;
  /**
   * True once Google and Apple Maps list this store under the brand name.
   * Until then a maps search for "Chris N Eddy's, <address>" matches the name
   * to the Hollywood listing and routes the visitor there, so directions and
   * map links search the bare address instead (`mapsQuery` in
   * src/lib/directions.ts). Set it when the store's Google Business Profile is
   * live.
   */
  listedOnMaps?: boolean;
  lat: number;
  lng: number;
  hours: Array<[string, string]>;
  openingSpec?: Array<{ dayOfWeek: string[]; opens: string; closes: string }>;
};

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
    listedOnMaps: true,
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
  {
    id: "vannuys",
    name: "Van Nuys",
    neighbourhood: "Van Nuys",
    sub: "Now open",
    address: "14523 Sherman Way",
    city: "Van Nuys",
    region: "CA",
    postal: "91405",
    status: "Open daily",
    isOpen: true,
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
    openingSpec: [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "10:00",
        closes: "01:00",
      },
      { dayOfWeek: ["Friday", "Saturday", "Sunday"], opens: "10:00", closes: "02:00" },
    ],
  },
];

/**
 * The store that answers `hollywood@`, orders and JSON-LD without a location
 * of its own, and every `find(... "hollywood")` that used to need a fallback
 * for a lookup typed as possibly missing. Hollywood is first above and the
 * array is never empty, so this is safe — kept as a named constant instead of
 * a bare `locations[0]` at each call site.
 */
export const flagship: Location = locations[0]!; // literal array above is non-empty
