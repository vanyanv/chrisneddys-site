/**
 * The live Chris N Eddy's menu, mirrored from the Otter Direct storefront.
 *
 * `otterId` is the item UUID Otter uses in its own URLs. Combined with the
 * store path in `otter.ts` it produces a link that opens that exact item with
 * its add-to-cart sheet already up — see `itemOrderUrl`.
 *
 * Prices and names must match the storefront exactly. When an item is renamed
 * or recreated in Otter its UUID changes and the deep link 404s, so treat this
 * file as a mirror of Otter, never as an independent source of truth.
 *
 * Last reconciled with the storefront: 2026-09-08.
 */

export type MenuItem = {
  /** Stable slug for React keys and in-page anchors. */
  id: string;
  /** Otter item UUID. Drives the per-item deep link. */
  otterId: string;
  /** Exactly as Otter names it — the name is part of the deep link path. */
  name: string;
  desc: string;
  /** US dollars, pickup price from the Hollywood storefront. */
  price: number;
  signature?: boolean;
  /** True when the item accepts the free topping modifiers (the Ways). */
  takesToppings?: boolean;
};

export type MenuCategoryKey = "combos" | "sides" | "secret" | "drinks";

export const categoryTitles: Record<MenuCategoryKey, string> = {
  combos: "Slider & Fries Combos",
  sides: "On The Side",
  secret: "Secret Menu",
  drinks: "Drinks",
};

export const menu: Record<MenuCategoryKey, MenuItem[]> = {
  combos: [
    {
      id: "1-slider-and-fries",
      otterId: "d119da4a-bfc1-4913-8249-21dd96d58456",
      name: "1 Slider and Fries",
      desc: "One slider and a side of chris-cut fries. A slider is two smashed patties on two slices of cheese, buttered Martin’s roll.",
      price: 11.49,
      takesToppings: true,
    },
    {
      id: "2-sliders-and-fries",
      otterId: "7bbcdf64-0e6f-489f-8ca4-0bee1e835bb0",
      name: "2 Sliders and Fries",
      desc: "Two sliders and a side of chris-cut fries. The order most people are actually here for.",
      price: 16.49,
      signature: true,
      takesToppings: true,
    },
    {
      id: "2-triples-and-fries",
      otterId: "c191ef14-1142-4b82-a230-8fe5850bbb7f",
      name: "2 Triples and Fries",
      desc: "Two triples — three patties, three slices of cheese each — and a side of fries.",
      price: 19.49,
      takesToppings: true,
    },
    {
      id: "2-grilled-cheeses-and-fries",
      otterId: "ea389886-8fd5-4871-a31e-6cfc76eebdea",
      name: "2 Grilled Cheeses and Fries",
      desc: "Two grilled cheeses with a side of chris-cut fries.",
      price: 11.69,
    },
  ],
  sides: [
    {
      id: "chris-n-eddy-s-slider",
      otterId: "de38e42c-7600-473f-913f-acb6b2a45aa8",
      name: "Chris N Eddy's Slider",
      desc: "Two smashed patties, two slices of cheese, buttered and toasted Martin’s potato roll.",
      price: 7.49,
      signature: true,
      takesToppings: true,
    },
    {
      id: "single-patty-slider",
      otterId: "9f342712-de8e-4a0f-9680-c55fbc60bc2e",
      name: "Single Patty Slider",
      desc: "One smashed patty and a slice of cheese on a buttered, toasted Martin’s roll.",
      price: 6.49,
      takesToppings: true,
    },
    {
      id: "triple-patty-slider",
      otterId: "123dd31f-36a8-48ff-9f6e-40aeb7b4c3d9",
      name: "Triple Patty Slider",
      desc: "Three smashed patties on three slices of cheese.",
      price: 8.49,
      takesToppings: true,
    },
    {
      id: "grilled-cheese",
      otterId: "5a6adaac-1bee-49a9-afbd-9449756a0d1e",
      name: "Grilled Cheese",
      desc: "Two slices of cheese in a buttered, reverse-toasted Martin’s potato bun.",
      price: 4,
    },
    {
      id: "straight-cut-fries",
      otterId: "2736f0a2-a7c8-4901-8a3d-3f074367b70a",
      name: "Straight-Cut Fries",
      desc: "A side portion of our seasoned chris-cut fries.",
      price: 4.49,
    },
    {
      id: "cheese-fries",
      otterId: "e2233b25-5761-4be8-a891-4e6e77aa1a50",
      name: "Cheese Fries",
      desc: "Melted cheese over our seasoned chris-cut fries.",
      price: 5.99,
    },
    {
      id: "loaded-fries",
      otterId: "db826564-9237-48f6-9756-b8320bea377c",
      name: "Loaded Fries",
      desc: "Melted cheese, Chris N Eddy’s sauce and grilled onions over the fries.",
      price: 6.99,
    },
    {
      id: "side-of-yellow-chilies",
      otterId: "4e0c491a-57b0-44ac-9964-a22ce05670e6",
      name: "Side of Yellow Chilies",
      desc: "2–3 yellow chilies in a 2oz cup.",
      price: 0.25,
    },
    {
      id: "extra-chris-n-eddy-s-sauce",
      otterId: "ece67cf5-f628-4562-a2a0-7f445403a650",
      name: "Extra Chris N Eddy's Sauce",
      desc: "The signature sauce, in a 4oz cup.",
      price: 0.75,
    },
  ],
  secret: [
    {
      id: "the-quad",
      otterId: "43d72be5-d38f-459d-9306-4c45f512715a",
      name: "The Quad",
      desc: "Four smashed patties on four slices of cheese, one roll. Exactly what it says.",
      price: 11.28,
      signature: true,
      takesToppings: true,
    },
    {
      id: "the-triple-pack",
      otterId: "b5fa7b7a-c1bf-4516-885d-02aac4571cfe",
      name: "The Triple Pack",
      desc: "Three doubles with a side of chris-cut fries.",
      price: 28.08,
      takesToppings: true,
    },
    {
      id: "the-family-box",
      otterId: "283855c8-4586-4f3e-9457-aa2528f6dad9",
      name: "The Family Box",
      desc: "Four doubles with two sides of chris-cut fries.",
      price: 37.20,
      takesToppings: true,
    },
    {
      id: "the-reverse-bun",
      otterId: "e6bc7175-79e2-4813-abca-d1618df90ba8",
      name: "The Reverse Bun",
      desc: "The Slider, but the toasted buns go on upside down.",
      price: 7.92,
      takesToppings: true,
    },
    {
      id: "chris-n-eddy-s-ball-cap-limited-run",
      otterId: "32636e41-adf8-4307-b68e-4bb34fb71364",
      name: "Chris N Eddy's Ball-Cap (Limited Run)",
      desc: "Limited quantity. One size fits all.",
      price: 48,
    },
  ],
  drinks: [
    {
      id: "strawberry-shake-20-oz-cup",
      otterId: "931c2d0b-54c2-420b-b5eb-fbb2201fa223",
      name: "Strawberry Shake (20 oz cup)",
      desc: "20oz. A quiet legend.",
      price: 4.49,
    },
    {
      id: "chocolate-shake-20-oz-cup",
      otterId: "0de9cdf0-14b6-49b7-bba8-753950e48f6f",
      name: "Chocolate Shake (20 oz cup)",
      desc: "20oz. Rich.",
      price: 4.49,
    },
    {
      id: "vanilla-shake-20-oz-cup",
      otterId: "e7e9803f-644d-4598-bf80-2032de2966f3",
      name: "Vanilla Shake (20 oz cup)",
      desc: "20oz. Classic.",
      price: 5.04,
    },
    {
      id: "coca-cola-20-oz-cup",
      otterId: "85984a1b-6a80-4038-acb0-7243d4739566",
      name: "Coca Cola (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "diet-coke-20-oz-cup",
      otterId: "c5dbe882-3600-413a-aae7-bd22dd1ecb2c",
      name: "Diet Coke (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "coke-zero-20-oz-cup",
      otterId: "69307336-d6a0-4694-89b5-4c47b31d6b3a",
      name: "Coke Zero (20 oz cup)",
      desc: "",
      price: 2.89,
    },
    {
      id: "sprite-20-oz-cup",
      otterId: "1d78e878-eae1-488f-a6a8-5829194c7282",
      name: "Sprite (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "orange-fanta-20-oz-cup",
      otterId: "1d9e0d63-4326-4ec5-8708-839c730171d0",
      name: "Orange Fanta (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "hi-c-20-oz-cup",
      otterId: "b007e9bd-fd56-4d9f-a414-996a5f419bac",
      name: "Hi-C (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "minute-maid-20-oz-cup",
      otterId: "bcb86e49-ab7e-49d6-a580-169207b548d3",
      name: "Minute Maid (20 oz cup)",
      desc: "",
      price: 2.99,
    },
    {
      id: "mexican-sprite-500ml",
      otterId: "5cfc1be8-1861-4b8a-8acd-0a7d2cb1a6a5",
      name: "Mexican Sprite 500ml",
      desc: "",
      price: 4.20,
    },
    {
      id: "mexican-fanta-500ml",
      otterId: "bf389591-c2c2-4d35-8ae0-66544c8f2fb2",
      name: "Mexican Fanta 500ml",
      desc: "",
      price: 4.20,
    },
    {
      id: "bottle-of-water",
      otterId: "59a1a9fe-283b-46ec-92a1-6af650139cf2",
      name: "Bottle of Water",
      desc: "",
      price: 2.85,
    },
  ],
};

/** Every item, flat — for lookups and the sitemap-style sweeps. */
export const allItems: MenuItem[] = Object.values(menu).flat();

export function itemById(id: string): MenuItem | undefined {
  return allItems.find((i) => i.id === id);
}

/**
 * Otter cannot accept preselected modifiers through a link, so instead of
 * making people choose toppings twice we name the exact checkboxes that appear
 * on the Otter item screen. `taps` are those checkbox labels verbatim.
 */
export const ways = [
  {
    id: "chris",
    name: "Chris’s Way",
    summary: "Lettuce, tomato, sauce, raw onion",
    taps: ["Add Lettuce", "Add Tomato", "Add Sauce", "Add Raw Onion"],
  },
  {
    id: "eddy",
    name: "Eddy’s Way",
    summary: "Sauce, grilled onion",
    taps: ["Add Sauce", "Add Grilled Onion"],
  },
] as const;

export type Way = (typeof ways)[number];

/** Free topping modifiers, as Otter lists them. */
export const toppings = [
  { id: "cne-sauce", name: "CNE Sauce" },
  { id: "lettuce", name: "Lettuce" },
  { id: "tomato", name: "Tomato" },
  { id: "raw-onions", name: "Raw Onions" },
  { id: "grilled-onions", name: "Grilled Onions" },
  { id: "pickles", name: "Pickles" },
] as const;

/** Paid modifiers, with the prices Otter charges. */
export const extras = [
  { name: "Extra Cheese", price: 1 },
  { name: "Make it Halal", price: 2 },
] as const;
