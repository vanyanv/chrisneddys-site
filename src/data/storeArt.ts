import type { Location } from "@/data/locations";

type Photo = { name: string; alt: string };

/**
 * The stores with photos of their own: the room beside the sign, and three
 * portrait crops of its walls for the strip under the hero, in walking order.
 * Each store shows only its own room. Any store not listed (Glendale) gets
 * the mural's checkerboard tunnel in the photo's place and no strip.
 */
export const STORE_ART: Partial<
  Record<Location["id"], { room: Photo; artist: string; walls: Photo[] }>
> = {
  hollywood: {
    room: {
      name: "hollywood-room",
      alt: "Inside Chris N Eddy's Hollywood: the logo on the floor, the menu board over the kitchen, and walls painted with monsters and op-art.",
    },
    artist: "Slider",
    walls: [
      {
        name: "mural-vortex",
        alt: "A black-and-white checkerboard tunnel painted on the wall, with blue, red and yellow one-eyed monsters being pulled into it.",
      },
      {
        name: "mural-monsters",
        alt: "Grinning one-eyed monsters in blue, red and yellow painted over a checkerboard wall, under a Slider tag.",
      },
      {
        name: "mural-hallway",
        alt: "The blacklight hallway: a lime one-eyed monster painted over the door, walls covered in neon numbers, dots and starbursts.",
      },
    ],
  },
  vannuys: {
    room: {
      name: "vannuys-hall-wide",
      alt: "The Van Nuys hallway: yellow, orange and red triangles and black swirls down one wall, the spec-sheet wall down the other.",
    },
    artist: "Robert Anthony Jacobs",
    walls: [
      {
        name: "vannuys-soundwave",
        alt: "The red one-eyed monster on the black sound-wave wall in the Van Nuys dining room.",
      },
      {
        name: "vannuys-swirl-tall",
        alt: "The glowing Chris N Eddy's sign on a black-and-white swirl mural, over a table and red chairs.",
      },
      {
        name: "vannuys-spec",
        alt: "The spec-sheet wall: dashed cut lines, the three locations, the origin story and a column of red to yellow dots.",
      },
    ],
  },
};

/**
 * The store's own photos at the largest size the page serves (each is cut by
 * `scripts/build-art-photos.mjs`): the room at 960px, the walls at 540px. For
 * the sitemap, so image search can reach them from the page they are on.
 */
export function storeArtImages(id: Location["id"]): string[] {
  const art = STORE_ART[id];
  if (!art) return [];
  return [
    `/photos/art/${art.room.name}-960.webp`,
    ...art.walls.map((w) => `/photos/art/${w.name}-540.webp`),
  ];
}
