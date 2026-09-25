/**
 * The monster colours, sampled from the artist's files, and which of the two
 * drawings (`monsterArt.ts`) a body colour gets. Kept apart from the drawings
 * so the client components that colour a monster don't ship its paths: those
 * are drawn once per page by `MascotDefs`.
 */

export const MONSTER_INK = "#231f20";
export const MONSTER_WHITE = "#ffffff";

/** Body and iris per colour. Lime is ours (the back-to-top, 404 and
 * late-night monsters); it borrows the red and yellow monsters' light-blue
 * iris. */
export const MONSTER_COLORS = {
  red: { body: "#ed1c24", iris: "#20b1ed" },
  yellow: { body: "#ffb81c", iris: "#20b1ed" },
  blue: { body: "#007fee", iris: "#ffb81c" },
  lime: { body: "#c6ff2b", iris: "#20b1ed" },
} as const;

/** The artist drew the red monster separately from the yellow and blue ones
 * (same file, recoloured), so red gets the `red` drawing and every other
 * colour the `classic` one. */
export function monsterDrawing(body: string): "classic" | "red" {
  return body.toLowerCase() === MONSTER_COLORS.red.body ? "red" : "classic";
}
