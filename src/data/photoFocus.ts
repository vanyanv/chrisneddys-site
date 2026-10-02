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
  "25f20ba6-6643-4d3d-b833-6bddbcedbfcc": [71, 132],
  "3bbad078-abd7-4c5a-9fd1-6c93497c3e9d": [79, 132],
  "3d70c8eb-c5d5-42c9-b018-1923e1a352f1": [78, 132],
  "3fafec93-49ce-41f1-b46b-db13730b8332": [50, 132],
  "51c416bb-c2f4-43b7-8710-5493f9d98ba3": [58, 132],
  "53ca84a1-1e6e-490a-be24-48ae7ad7a5fa": [87, 132],
  "6cff1a91-e6d5-4bad-adc6-e62bc26f19cf": [53, 132],
  "bef909bc-3438-482b-af96-4a1dcd28886b": [49, 132],
  "c6748e47-aa70-4aee-938b-91108530bb84": [65, 132],
  "cb39bdad-a744-46f1-b004-f78ac93596ff": [69, 132],
  "cheese-fries": [61, 113],
  "chocolate-shake": [100, 100],
  "coca-cola": [50, 100],
  "combo-1-chris": [98, 100],
  "combo-1-eddy": [97, 100],
  "combo-2-chris": [90, 100],
  "combo-2-eddy": [90, 100],
  "diet-coke": [100, 100],
  "f4a0f2cc-ba78-4149-88b7-c2f04c81903c": [54, 132],
  "fe9754fa-6f48-423a-a833-b52f0a9c2f89": [74, 132],
  "feaff547-96d8-4bf5-abe1-6d597acc02fb": [78, 132],
  "hi-c": [100, 100],
  "loaded-fries": [90, 107],
  "mexican-fanta": [83, 100],
  "mexican-sprite": [50, 100],
  "minute-maid": [85, 100],
  "orange-fanta": [100, 100],
  sprite: [50, 100],
  "strawberry-shake": [60, 100],
  "vanilla-shake": [80, 100],
  "water-bottle": [50, 100],
};

/** Framing for a photo, or a safe all-photo compromise when one is missing. */
export function framingFor(photo: string | undefined): readonly [number, number] {
  return (photo ? photoFraming[photo] : undefined) ?? [62, 132];
}
