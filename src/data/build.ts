/**
 * What physically lands in the bag, per item.
 *
 * Deliberately not in `menu.ts`. That file is a mirror of the Otter storefront
 * and says so: names, prices and UUIDs come from Otter and must match it
 * exactly. A build does not come from Otter — the storefront sells "2 Sliders
 * and Fries" as a name and a price and never itemises it. This is our own
 * account of what that name means, taken from the item descriptions.
 *
 * Composed from one definition of a slider rather than typed out eleven times.
 * "A double" is referred to by four separate descriptions, and four hand-typed
 * copies of it drift the first time the kitchen changes one. If a build
 * changes, change it here and move the matching `desc` in `menu.ts` with it.
 *
 * The item sheet prints this as a ticket, which is what lets picking a Way
 * show a visible result instead of rewriting a list of chores.
 */

export type BuildLine = {
  /** How many. Rendered as `4 ×`, tabular. */
  q: number;
  /** Sentence case; the ticket uppercases it. */
  n: string;
};

const PATTY = "Smashed patty";
const CHEESE = "Slice of cheese";
const ROLL = "Martin’s roll, buttered";
const FRIES = "Chris-cut fries";

/**
 * One slider is n patties, n slices of cheese and one roll. `of` multiplies the
 * whole thing, so a Triple Pack is `sliders(2, 3)` rather than nine numbers.
 */
function sliders(patties: number, of = 1): BuildLine[] {
  return [
    { q: patties * of, n: PATTY },
    { q: patties * of, n: CHEESE },
    { q: of, n: ROLL },
  ];
}

const fries = (q = 1): BuildLine => ({ q, n: FRIES });

/**
 * Keyed by `MenuItem.id`. Every item that takes toppings has an entry; items
 * that don't (drinks, a bag of fries, the ball cap) have nothing to itemise and
 * the sheet renders the ticket without a contents block.
 */
export const builds: Record<string, BuildLine[]> = {
  // combos
  "1-slider-and-fries": [...sliders(2), fries()],
  "2-sliders-and-fries": [...sliders(2, 2), fries()],
  "2-triples-and-fries": [...sliders(3, 2), fries()],

  // sides
  "chris-n-eddy-s-slider": sliders(2),
  "single-patty-slider": sliders(1),
  "triple-patty-slider": sliders(3),

  // secret
  "the-quad": sliders(4),
  "the-triple-pack": [...sliders(2, 3), fries()],
  "the-family-box": [...sliders(2, 4), fries(2)],
  // The one build that is not a standard slider: same parts, bun inverted.
  "the-reverse-bun": [
    { q: 2, n: PATTY },
    { q: 2, n: CHEESE },
    { q: 1, n: "Martin’s roll, upside down" },
  ],
};

/** The build for an item, or undefined when there is nothing to itemise. */
export function buildFor(id: string): BuildLine[] | undefined {
  return builds[id];
}
