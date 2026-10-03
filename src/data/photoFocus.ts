/**
 * How to frame each menu photograph in the item sheet's hero: `[focus, zoom]`,
 * where focus is a `background-position-y` percentage and zoom a
 * `background-size` percentage.
 *
 * Generated, not authored. Every shot in /public/menu is 720x479 (720x480 for
 * the photos added with `scripts/add-menu-photo.mjs`) on a white
 * sweep, and the food's place inside that frame varies a lot: one shot fills
 * 26-82% of the height, another only 43-78%, and the two Mexican bottles run
 * nearly the full height. One shared crop cannot serve all three cases — tuned
 * for the median it leaves empty paper above the food on half the menu, and
 * tightened to fix that it decapitates the bottles.
 *
 * So each photograph carries its own framing: the zoom is capped at whatever
 * still fits that shot's food, and the focus centres it. Both numbers are
 * derived from the food's measured bounding box, and every pair is asserted to
 * keep the whole box inside the frame.
 *
 * Regenerate when the photography changes. Keyed by `MenuItem.photo`.
 */
export const photoFraming: Record<string, readonly [focus: number, zoom: number]> = {
  "0fa97f11-898b-440d-b40e-dddb1e6fc897": [57, 132],
  "2-grilled-cheeses-and-fries": [55, 110],
  "6cff1a91-e6d5-4bad-adc6-e62bc26f19cf": [53, 132],
  "c6748e47-aa70-4aee-938b-91108530bb84": [65, 132],
  "cb39bdad-a744-46f1-b004-f78ac93596ff": [69, 132],
  "cheese-fries": [61, 113],
  "chocolate-shake": [100, 100],
  "chris-n-eddy-s-slider-chris": [87, 109],
  "chris-n-eddy-s-sauce": [80, 132],
  "chris-n-eddy-s-slider-eddy": [69, 132],
  "coca-cola": [50, 100],
  "combo-1-chris": [69, 110],
  "combo-1-eddy": [69, 107],
  "combo-2-chris": [65, 110],
  "combo-2-eddy": [65, 110],
  "diet-coke": [100, 100],
  "family-box-eddy": [68, 100],
  "grilled-cheese": [56, 117],
  "hi-c": [100, 100],
  "loaded-fries": [90, 107],
  "mexican-coke": [51, 106],
  "mexican-fanta": [83, 100],
  "mexican-sprite": [50, 100],
  "minute-maid": [85, 100],
  "orange-fanta": [100, 100],
  "reverse-bun-chris": [74, 131],
  "reverse-bun-eddy": [68, 132],
  "single-patty-slider-chris": [64, 132],
  "single-patty-slider-eddy": [65, 132],
  sprite: [50, 100],
  "straight-cut-fries": [53, 132],
  "strawberry-shake": [60, 100],
  "triple-pack-eddy": [62, 100],
  "vanilla-shake": [80, 100],
  "water-bottle": [50, 100],
  "yellow-chilies": [57, 132],
};

/** Framing for a photo, or a safe all-photo compromise when one is missing. */
export function framingFor(photo: string | undefined): readonly [number, number] {
  return (photo ? photoFraming[photo] : undefined) ?? [62, 132];
}
