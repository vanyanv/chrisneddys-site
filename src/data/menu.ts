export type MenuItem = {
  id: string;
  name: string;
  desc: string;
  signature?: boolean;
};

export type MenuCategoryKey = "sliders" | "ways" | "combos" | "sides" | "drinks";

export const menu: Record<MenuCategoryKey, MenuItem[]> = {
  sliders: [
    {
      id: "single",
      name: "Single Slider",
      desc: "One smashed patty, American cheese, buttered Martin’s potato roll.",
    },
    {
      id: "double",
      name: "The Double",
      desc: "Two smashed patties, two slices cheese. The one you came for.",
    },
    {
      id: "triple",
      name: "Triple",
      desc: "Three smashed patties, three slices cheese. No notes.",
    },
    {
      id: "gc",
      name: "Grilled Cheese",
      desc: "Two slices cheese on a buttered, reverse-toasted bun.",
    },
  ],
  ways: [
    {
      id: "chris-way",
      name: "Chris’s Way",
      desc: "Meat, cheese, lettuce, tomato, sauce, raw onions.",
      signature: true,
    },
    {
      id: "eddy-way",
      name: "Eddy’s Way",
      desc: "Meat, cheese, sauce, grilled onions.",
      signature: true,
    },
  ],
  combos: [
    {
      id: "c1",
      name: "Combo #1",
      desc: "Single + fries.",
    },
    {
      id: "c2",
      name: "Combo #2",
      desc: "Two sliders + fries. Most ordered.",
      signature: true,
    },
  ],
  sides: [
    {
      id: "fries",
      name: "Fries",
      desc: "Seasoned and hot.",
    },
    {
      id: "cheese-fries",
      name: "Cheese Fries",
      desc: "Fries, melted American cheese.",
    },
    {
      id: "loaded",
      name: "Loaded Fries",
      desc: "Sauce, melted cheese, grilled onions, over fries.",
    },
  ],
  drinks: [
    { id: "strawberry-shake", name: "Strawberry Shake", desc: "20oz. A quiet legend." },
    { id: "vanilla-shake", name: "Vanilla Shake", desc: "20oz. Classic." },
    { id: "chocolate-shake", name: "Chocolate Shake", desc: "20oz. Rich." },
  ],
};

export const toppings = [
  { id: "sauce", name: "CNE Sauce" },
  { id: "lettuce", name: "Lettuce" },
  { id: "tomato", name: "Tomato" },
  { id: "raw", name: "Raw Onions" },
  { id: "grilled", name: "Grilled Onions" },
  { id: "pickles", name: "Pickles" },
] as const;
