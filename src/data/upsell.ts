import { allItems, type MenuItem } from "./menu";

/**
 * The combo the item sheet suggests under a single item.
 *
 * Only where the combo really is "this, plus fries": 1 Slider and Fries is the
 * signature double with a side, so the signature slider points at it. The
 * single and triple have no one-slider combo of their own, and suggesting the
 * double's combo under them would swap the burger as well as add fries.
 *
 * Keyed by `MenuItem.id`, like `builds`. Not in `menu.ts`, which mirrors the
 * Otter storefront and nothing else.
 */
export const COMBO_FOR: Record<string, string> = {
  "chris-n-eddy-s-slider": "1-slider-and-fries",
};

export function comboFor(item: MenuItem): MenuItem | undefined {
  const id = COMBO_FOR[item.id];
  return id ? allItems.find((i) => i.id === id) : undefined;
}
