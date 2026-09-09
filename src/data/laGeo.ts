/**
 * Los Angeles, drawn once from OpenStreetMap and baked into the page.
 *
 * Three locations don't need a slippy map. A tiled map costs ~145 KB of
 * JavaScript, 36 requests to somebody else's tile servers, and a layout shift
 * when it mounts — to answer two questions ("which one is closest" and "get me
 * there") that end in the visitor's own navigation app anyway.
 *
 * So the geometry is fetched once from the Overpass API, simplified with
 * Douglas–Peucker, projected, and stored here as SVG path data: ~29 KB over
 * the wire, no network requests at runtime, no layout shift, and drawable in
 * brand colours because we own the render.
 *
 * Licence: © OpenStreetMap contributors, ODbL. The attribution is drawn into
 * the map and is required — do not remove it.
 */

/**
 * Equirectangular projection box. The pixel aspect ratio already accounts for
 * the cosine of latitude at 34.15°N, so x and y share one scale.
 */
export const mapBox = {
  w: 360,
  h: 259,
  lng0: -118.49,
  lngS: 0.3,
  lat1: 34.24,
  latS: 0.18,
} as const;

export const projectX = (lng: number): number => ((lng - mapBox.lng0) / mapBox.lngS) * mapBox.w;
export const projectY = (lat: number): number => ((mapBox.lat1 - lat) / mapBox.latS) * mapBox.h;

/** Kilometres per horizontal pixel, for the scale bar and distance rings. */
export const pxPerKm = mapBox.w / (mapBox.lngS * 111.32 * Math.cos((34.15 * Math.PI) / 180));

/**
 * The heavy path data lives in `./laGeoPaths` so that only the server
 * component that draws it pulls it in. Anything that just needs to place a
 * point on the map — the interactive pin overlay — imports this file instead
 * and stays a few hundred bytes.
 */
