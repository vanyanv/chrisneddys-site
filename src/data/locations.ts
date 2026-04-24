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
    hours: [
      ["Mon–Thu", "10:00 AM – 1:00 AM"],
      ["Fri–Sat", "10:00 AM – 2:00 AM"],
      ["Sunday", "10:00 AM – 1:00 AM"],
    ],
    openingSpec: [
      {
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Sunday"],
        opens: "10:00",
        closes: "25:00",
      },
      { dayOfWeek: ["Friday", "Saturday"], opens: "10:00", closes: "26:00" },
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
    hours: [["Launch", "May 2026"]],
  },
];
