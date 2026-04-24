export type MenuItem = {
  id: string;
  name: string;
  desc: string;
  price: string;
  signature?: boolean;
};

export type MenuCategoryKey = "sliders" | "combos" | "sides" | "drinks";

export const menu: Record<MenuCategoryKey, MenuItem[]> = {
  sliders: [
    {
      id: "single",
      name: "Single Slider",
      desc: "One smashed patty, American cheese, buttered Martin’s potato roll.",
      price: "6",
    },
    {
      id: "double",
      name: "The Double",
      desc: "Two smashed patties, two slices cheese. The one you came for.",
      price: "8",
      signature: true,
    },
    {
      id: "triple",
      name: "Triple",
      desc: "Three smashed patties, three slices cheese. No notes.",
      price: "10",
    },
    {
      id: "gc",
      name: "Grilled Cheese",
      desc: "Two slices cheese on a buttered, reverse-toasted bun.",
      price: "5",
    },
  ],
  combos: [
    {
      id: "c1",
      name: "Combo #1",
      desc: "Single + Chris-Cut fries + drink.",
      price: "11.49",
    },
    {
      id: "c2",
      name: "Combo #2",
      desc: "Two sliders + Chris-Cut fries + drink. Most ordered.",
      price: "14.49",
      signature: true,
    },
  ],
  sides: [
    {
      id: "chriscut",
      name: "Chris-Cut Fries",
      desc: "Crinkle-cut, seasoned. House signature.",
      price: "4",
    },
    {
      id: "tots",
      name: "Tater Tots",
      desc: "Crisp on the outside, molten in the middle.",
      price: "4",
    },
    { id: "waffle", name: "Waffle Fries", desc: "Golden grid iron.", price: "4.5" },
    {
      id: "loaded",
      name: "Loaded Fries",
      desc: "Sauce, melted cheese, grilled onions, Chris-Cut base.",
      price: "7",
    },
  ],
  drinks: [
    { id: "shake", name: "Strawberry Shake", desc: "20oz. A quiet legend.", price: "6" },
    { id: "soda", name: "Fountain Soda", desc: "Free refills in-store.", price: "3" },
  ],
};

export const toppings = [
  { id: "sauce", name: "CNE Sauce" },
  { id: "lettuce", name: "Lettuce" },
  { id: "tomato", name: "Tomato" },
  { id: "raw", name: "Raw Onions" },
  { id: "grilled", name: "Grilled Onions" },
  { id: "pickles", name: "Pickles" },
  { id: "cheese", name: "Extra Cheese" },
] as const;
