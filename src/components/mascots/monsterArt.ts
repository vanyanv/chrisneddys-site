/**
 * The monster art, traced from the artist's own files (RED_, YELLOW_ and
 * BLUE_NEW_CYCLOPS_HAT_1.PNG, sent 2026-09-25) into flat shapes on a
 * 1000x1000 grid (whole units keep the paths small; the symbols scale it to
 * whatever size they're drawn at), so every monster on the site is the artist's drawing rather than a
 * lookalike. The yellow and blue files are one drawing in two colours; the
 * red file is drawn separately (its pupil looks right, the others' look up and
 * left), so red monsters use `red` and every other colour uses `classic`
 * (`monsterDrawing` in `monsterColors.ts`). Only server code and build
 * scripts import this file; the page gets the paths once, from `MascotDefs`.
 *
 * Generated: the tracing script and the source PNGs are kept with the
 * project's files (artist-monsters/). Don't hand-edit a path; re-trace.
 */

import { MONSTER_INK, MONSTER_WHITE, monsterDrawing } from "./monsterColors.ts";

export interface MonsterDrawing {
  /** The whole silhouette, filled with ink: it is the outer outline. */
  outline: string;
  /** The coloured face inside the outline, eye and mouth included. */
  body: string;
  mouth: string;
  teethTop: string;
  teethBottom: string;
  /** The eye's thick ring, filled with ink; the white sits on top of it. */
  eye: string;
  eyeWhite: string;
  iris: string;
  pupil: string;
}

export const MONSTER_DRAWINGS: Record<"classic" | "red", MonsterDrawing> = {
  classic: {
    outline:
      "M485 103A452 452 0 0 0 49 523a428 428 0 0 0 19 154 403 403 0 0 0 120 177 435 435 0 0 0 254 103h89l15-2 16-2a530 530 0 0 0 237-97l11-8a408 408 0 0 0 113-145 346 346 0 0 0 30-151v-5l-1 10v-13l-2-29a457 457 0 0 0-114-253l-10-12c-14-16-47-46-70-63a418 418 0 0 0-252-84zM48 552v8-16z",
    body: "M479 136A414 414 0 0 0 94 651a387 387 0 0 0 359 275 491 491 0 0 0 191-25 395 395 0 0 0 261-242c14-42 18-81 15-131-7-108-66-221-155-296a401 401 0 0 0-286-96",
    mouth:
      "M701 462c-14 1-41 5-60 9-56 12-58 12-90 16l-16 3-40 2c-9-2-29-3-48-4l-54-3-23-2-28-4-27-5-46-6-30-5h-34c-26 4-55 31-67 63a212 212 0 0 0-10 107c3 17 6 27 15 47q16 33 38 63c9 11 35 35 51 46l12 9q15 10 33 19l22 11 18 9 57 21 18 5 34 7 8 2 11 1 11 1a771 771 0 0 0 83-1l14-2c14-2 44-9 63-16 12-4 15-5 28-13l18-10 11-5c54-32 57-34 95-70l24-21c14-13 25-26 45-56l18-27 9-32a241 241 0 0 0-1-57c-3-12-3-15-9-31-9-24-13-32-24-44q-13-13-31-18c-18-6-26-7-43-8l-13-1z",
    teethTop:
      "M700 484h-5l2 5 5 11q19 38 33 52 6 7 12 7c13 0 42-22 53-41l9-17c0-4-26-13-44-15-14-2-54-3-65-2m-38 4-34 7a807 807 0 0 1-95 16l-12 1q-6 0-5 3l26 52c8 14 19 30 22 33q7 6 18 1c13-7 21-14 40-40l14-17c13-16 40-55 40-57 0-1-1-1-14 1m-452 0q-9 1-17 5c-6 3-15 10-15 11l8 33q10 31 25 31 3 1 8-1c5-3 8-6 35-33q39-39 32-39l-31-3c-7-2-33-4-38-4zm94 11a339 339 0 0 0 42 68l14 18c10 13 23 25 29 28q13 6 33-7 18-11 47-52c11-17 17-25 25-34q6-7 1-6l-11-1-25-2-78-5-14-1c-17-1-23-1-31-3l-27-4z",
    teethBottom:
      "M746 671q-14 5-21 14c-4 4-12 20-15 28-5 16-11 68-8 68l21-15 25-22 19-17c15-14 23-21 30-31 3-5 3-5 1-8-7-8-15-13-33-16q-12-3-19-1m-485 38q-15 2-41 27l-8 10a305 305 0 0 0 87 58l52 23q1-2-1-9-19-77-51-98-20-14-38-11m345 12c-6 3-17 16-23 28a662 662 0 0 0-30 96c1 2 2 1 13-1q47-11 63-23l19-10 37-20-4-5-16-20c-5-7-25-27-32-33q-18-15-27-12m-181 21c-9 5-21 21-45 63q-15 26-13 27 2 3 47 13c18 5 28 6 42 7h12c9 1 54-1 69-3 4 0 5 1-15-23l-28-34q-17-24-41-43-7-6-13-7-7-3-15 0",
    eye: "M479 184c-25 0-55 6-71 14a150 150 0 0 0-88 98c-7 20-8 46-3 62q8 24 27 43c8 8 12 11 28 23l26 16 6 3a182 182 0 0 0 120 19l23-7q31-10 69-37c19-13 38-34 45-48 10-22 12-37 7-63-1-7-7-25-9-30a168 168 0 0 0-42-55c-22-19-57-32-96-36l-31-3z",
    eyeWhite:
      "M469 203c-28 2-58 12-79 27-26 19-45 47-50 76q-12 55 39 94a167 167 0 0 0 134 35c50-8 99-40 116-74q11-19 9-46c-2-33-25-68-58-88q-37-24-92-24z",
    iris: "m476 240-7 1-6 2-7 2c-21 6-33 18-41 44-10 27-5 43 16 64 15 14 31 20 57 20q28 0 44-15c10-11 13-15 17-25l4-10q8-21 4-41c-4-12-15-27-27-32l-8-3c-13-6-35-10-46-7",
    pupil: "M470 274q-12 4-18 16-8 18 3 30c9 9 23 8 34-2 16-15 16-36 1-43q-9-4-20-1",
  },
  red: {
    outline:
      "M486 107a464 464 0 0 0-288 116l-10 9-18 19A435 435 0 0 0 50 504l-2 47a400 400 0 0 0 69 220 405 405 0 0 0 142 128 462 462 0 0 0 208 54 543 543 0 0 0 270-64l15-8c10-5 36-23 46-31l10-7c5-4 22-19 35-33a364 364 0 0 0 110-279l-1-6q-5-61-26-119a478 478 0 0 0-137-194 430 430 0 0 0-303-105M48 547v10-20z",
    body: "M483 139A433 433 0 0 0 99 428c-9 26-16 61-18 85l-1 18c-3 42 5 98 21 142a382 382 0 0 0 272 236c113 27 242 10 346-46a370 370 0 0 0 195-248c8-37 9-81 4-119q-16-109-87-199a416 416 0 0 0-348-158",
    mouth:
      "M702 458q-27 2-77 14c-29 7-33 8-56 11l-24 5c-12 2-30 4-39 3a889 889 0 0 0-88-4l-29-1-40-3c-15-2-17-3-56-4l-24-2c-59-5-82-1-106 20a89 89 0 0 0-32 62q-5 43 10 84c10 26 45 90 59 106a303 303 0 0 0 115 83 457 457 0 0 0 191 34h20l20-1 15-2c21-2 57-9 77-15 9-3 47-20 62-28 28-15 41-23 59-39l47-48c8-9 22-28 31-44l11-17c10-16 13-21 18-38 5-15 6-24 6-44 1-22-3-42-15-69q-13-31-41-46l-29-10-23-4-15-1c-18-2-29-3-47-2",
    teethTop:
      "m710 481-8 1 1 4 14 23c13 22 16 28 23 37 15 19 20 20 41 4q17-13 29-33l6-16c0-4-30-15-47-17-20-2-46-4-51-3zm-38 7-36 9-56 12-25 5-19 3-6 1c-2 1 44 78 57 95q9 13 20 5c13-8 20-17 36-46l13-22 30-64zm-458 10q-18 1-30 10-7 4-5 6l6 11c15 29 22 38 33 43q13 8 31-12l35-36 11-18-13-1-21-2c-15-2-39-2-47-1m95 8 7 12 15 18 12 16 16 21 27 32q17 22 27 27c15 8 38-4 54-28 11-17 15-24 29-53l10-20c7-13 7-13 2-13h-11l-26-2-130-7-28-3z",
    teethBottom:
      "M764 677q-17 6-26 23c-9 18-13 33-19 71q-3 17-1 15l19-13a792 792 0 0 0 73-81c0-2-7-8-12-11-10-5-26-7-34-4m-492 40c-12 3-32 15-43 26l-4 3 9 9a322 322 0 0 0 100 65l30 10a206 206 0 0 0-10-46q-10-27-24-45c-7-9-23-19-34-22zm357 20q-12 9-25 34l-35 67q-5 9-1 7l8-1q46-9 68-19l17-8c15-7 39-19 40-21l-4-5-10-12q-9-13-23-25c-18-17-27-22-35-17m-177 21q-11 3-30 26l-21 24-22 26a434 434 0 0 0 120 16l19-1 34-2c1-1-2-3-12-15q-17-18-26-31-15-19-37-36-14-11-25-7",
    eye: "M476 175a154 154 0 0 0-53 14l-5 2-7 3-5 3-6 3-10 6c-16 10-39 30-50 43a140 140 0 0 0-19 30c-8 15-10 37-7 57a162 162 0 0 0 152 122 233 233 0 0 0 136-32l7-5a126 126 0 0 0 49-134c-2-9-9-24-13-30l-5-6a141 141 0 0 0-33-32c-4-4-20-14-28-18q-55-30-103-26",
    eyeWhite:
      "m478 201-6 1-29 7-34 15c-10 5-27 18-38 29a98 98 0 0 0-28 50c-6 33 9 68 41 96 43 37 115 45 178 21 30-12 55-35 67-60 10-21 12-49 5-70q-15-43-66-70-26-13-53-17c-10-2-12-2-24-2z",
    iris: "M498 250q-33 5-46 18l-14 20q-7 15-4 44c3 16 6 23 17 34 16 14 28 18 54 18 12-1 14-1 24-6q31-15 38-57 7-34-14-54-13-13-26-16c-5-2-21-2-29-1",
    pupil: "M505 285c-19 3-30 33-17 46q6 6 15 5c6 0 7 0 11-2 16-8 22-27 12-40q-8-10-21-9",
  },
};

/** A standalone SVG of one monster with its colours resolved, for places that
 * can't reach the page's shared symbols: the browser-tab icon, the share card
 * and the email pictures. */
export function monsterSvg(body: string, iris: string, viewBox = "40 70 920 920"): string {
  const d = MONSTER_DRAWINGS[monsterDrawing(body)];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
    `<defs><clipPath id="m"><path d="${d.mouth}"/></clipPath></defs>` +
    `<path d="${d.outline}" fill="${MONSTER_INK}"/><path d="${d.body}" fill="${body}"/>` +
    `<g clip-path="url(#m)"><path d="${d.mouth}" fill="${MONSTER_INK}"/>` +
    `<path d="${d.teethTop}" fill="${MONSTER_WHITE}"/><path d="${d.teethBottom}" fill="${MONSTER_WHITE}"/></g>` +
    `<path d="${d.eye}" fill="${MONSTER_INK}"/><path d="${d.eyeWhite}" fill="${MONSTER_WHITE}"/>` +
    `<path d="${d.iris}" fill="${iris}"/><path d="${d.pupil}" fill="${MONSTER_INK}"/></svg>`
  );
}
