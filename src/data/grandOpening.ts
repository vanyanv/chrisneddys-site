import type { Location } from "@/data/locations";

/**
 * A store's grand opening, word for word from the owner's flyer. While one
 * is coming up, the opening-list reply (`openingReplyEmail`) carries these
 * details instead of "Date to be announced", so someone who signs up after
 * the announcement went out still gets it.
 */
type GrandOpening = {
  locationId: Location["id"];
  /** "Friday, October 30, 2026" */
  dateLabel: string;
  /** "Glendale opens Friday, October 30." */
  heading: string;
  doors: string;
  drop: string;
  extras: string;
  /** Served from `public/`, so email clients can load it. */
  flyerPath: string;
  flyerAlt: string;
  /** The reply goes back to normal from this moment: midnight in Los
   * Angeles at the end of opening day. */
  until: Date;
};

const grandOpenings: GrandOpening[] = [
  {
    locationId: "glendale",
    dateLabel: "Friday, October 30, 2026",
    heading: "Glendale opens Friday, October 30.",
    doors: "Doors open at 6 PM",
    drop: "First 30 customers will receive an official Chris N Eddy's individually numbered, limited-edition hat. One of only 50 made.",
    extras: "Open to the public. Artist designed space by @robertanthonyjacobs.",
    flyerPath: "/email/glendale-grand-opening.jpg",
    flyerAlt:
      "Chris N Eddy's Grand Opening. Location No. 03, Glendale, CA. Friday, October 30, 2026. 1360 E Colorado St, Glendale, CA 91205. Doors open at 6 PM. First 30 customers will receive an official Chris N Eddy's individually numbered, limited-edition hat, one of only 50 made. Open to the public. Artist designed space. @robertanthonyjacobs",
    until: new Date("2026-10-31T07:00:00Z"),
  },
];

/** The grand opening still ahead (or under way today) for this store. */
export function upcomingGrandOpening(location: Location, at: Date): GrandOpening | undefined {
  return grandOpenings.find((g) => g.locationId === location.id && at < g.until);
}
