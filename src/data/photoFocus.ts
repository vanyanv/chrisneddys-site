/**
 * How to frame each menu photograph in the item sheet's hero: `[focus, zoom]`,
 * where focus is a `background-position-y` percentage and zoom a
 * `background-size` percentage.
 *
 * Generated, not authored. Every shot in /public/menu is 720x479 on a white
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
  "0a500a4b-3624-4ea3-b99a-9a5f83f2155b": [66, 132],
  "0fa97f11-898b-440d-b40e-dddb1e6fc897": [57, 132],
  "115c038a-7ed0-4de8-9c67-d7bf54d70f0e": [79, 132],
  "1d36f305-06ca-4bfe-bbc7-c01aa67757f5": [50, 100],
  "25f20ba6-6643-4d3d-b833-6bddbcedbfcc": [71, 132],
  "3bbad078-abd7-4c5a-9fd1-6c93497c3e9d": [79, 132],
  "3d70c8eb-c5d5-42c9-b018-1923e1a352f1": [78, 132],
  "3fafec93-49ce-41f1-b46b-db13730b8332": [50, 132],
  "42b6ff6c-9e02-43da-bdeb-dd181e8ec348": [65, 132],
  "51c416bb-c2f4-43b7-8710-5493f9d98ba3": [58, 132],
  "53ca84a1-1e6e-490a-be24-48ae7ad7a5fa": [87, 132],
  "5f336391-8daf-4d23-929a-cb78c125ce0d": [93, 132],
  "688ed85d-8dd9-4d31-be94-5994801863be": [56, 132],
  "6cff1a91-e6d5-4bad-adc6-e62bc26f19cf": [53, 132],
  "6dcd14a3-7032-489a-9e66-5f4718e96af1": [89, 132],
  "6e108101-0671-4280-a3f9-69d5738349b7": [50, 100],
  "7678a45c-dd42-4249-a148-ca575e757d3d": [78, 132],
  "828b4720-c3f3-42d0-b5f6-851bb8ec6621": [76, 132],
  "90727ef0-3fff-4e67-afd1-77d34ed83417": [78, 132],
  "914889df-3ce3-4968-9f8b-3ad1154c28c2": [78, 132],
  "953b863c-2e2a-4d60-b1a2-436c1db3a149": [71, 132],
  "a9ccb11e-44fa-4241-bb8c-b9ffb6288d07": [75, 132],
  "bef909bc-3438-482b-af96-4a1dcd28886b": [49, 132],
  "c6748e47-aa70-4aee-938b-91108530bb84": [65, 132],
  "cb39bdad-a744-46f1-b004-f78ac93596ff": [69, 132],
  "cceb4fd1-72ae-43f5-8432-8e4648f26e07": [66, 132],
  "e714a53e-90be-4cc8-8692-1358c9faebb1": [70, 132],
  "f4a0f2cc-ba78-4149-88b7-c2f04c81903c": [54, 132],
  "fe9754fa-6f48-423a-a833-b52f0a9c2f89": [74, 132],
  "feaff547-96d8-4bf5-abe1-6d597acc02fb": [78, 132],
};

/** Framing for a photo, or a safe all-photo compromise when one is missing. */
export function framingFor(photo: string | undefined): readonly [number, number] {
  return (photo ? photoFraming[photo] : undefined) ?? [62, 132];
}
