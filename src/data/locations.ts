import { brand } from "./brand";

export type Location = {
  id: "hollywood" | "glendale" | "vannuys";
  name: string;
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
  lat: number;
  lng: number;
  hours: Array<[string, string]>;
  openingSpec?: Array<{ dayOfWeek: string[]; opens: string; closes: string }>;
};

export const locations: Location[] = [
  {
    id: "hollywood",
    name: "Hollywood",
    sub: "Open since 2021",
    address: "5539 W. Sunset Blvd",
    city: "Los Angeles",
    region: "CA",
    postal: "90028",
    status: "Open daily",
    isOpen: true,
    phone: brand.phone,
    phoneTel: brand.phoneTel,
    lat: 34.0980,
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
    sub: "Opening soon",
    address: "1360 E Colorado St",
    city: "Glendale",
    region: "CA",
    postal: "91205",
    status: "Opening soon",
    isOpen: false,
    lat: 34.1393,
    lng: -118.2380,
    hours: [["Launch", "Date to be announced"]],
    // No openingSpec until it opens: it is what the live open/closed pill and
    // the JSON-LD openingHoursSpecification are both built from, and neither
    // should claim hours for a location that is not serving.
  },
  {
    id: "vannuys",
    name: "Van Nuys",
    sub: "Opening soon",
    address: "14523 Sherman Way",
    city: "Van Nuys",
    region: "CA",
    postal: "91405",
    status: "Opening soon",
    isOpen: false,
    lat: 34.2011,
    lng: -118.4497,
    hours: [["Launch", "Date to be announced"]],
  },
];

/**
 * Fallback for a `find` by id that should always succeed but is typed as
 * possibly missing. Hollywood is first above and the array is never empty,
 * so this is safe — kept as a named constant instead of a bare `locations[0]`
 * at each call site.
 */
export const DEFAULT_LOCATION: Location = locations[0]!; // literal array above is non-empty
