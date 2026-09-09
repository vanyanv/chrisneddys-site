export type Location = {
  id: "hollywood" | "glendale" | "vannuys";
  name: string;
  sub: string;
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
    sub: "The original",
    address: "5539 W. Sunset Blvd",
    city: "Los Angeles",
    region: "CA",
    postal: "90028",
    status: "Open daily",
    isOpen: true,
    lat: 34.0983,
    lng: -118.3106,
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
    sub: "Now open",
    address: "1360 E Colorado St",
    city: "Glendale",
    region: "CA",
    postal: "91205",
    status: "Open daily",
    isOpen: true,
    lat: 34.1393,
    lng: -118.2380,
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
