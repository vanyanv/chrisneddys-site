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
    sub: "Opening Spring 2026",
    address: "1360 E. Colorado Blvd",
    city: "Glendale",
    region: "CA",
    postal: "",
    status: "Opening March",
    isOpen: false,
    lat: 34.1463,
    lng: -118.2360,
    hours: [["Launch", "March 2026"]],
  },
  {
    id: "vannuys",
    name: "Van Nuys",
    sub: "Opening Spring 2026",
    address: "Sherman Way & Van Nuys Blvd",
    city: "Van Nuys",
    region: "CA",
    postal: "",
    status: "Opening May",
    isOpen: false,
    lat: 34.2010,
    lng: -118.4487,
    hours: [["Launch", "May 2026"]],
  },
];
