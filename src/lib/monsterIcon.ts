import { monsterSvg } from "../components/mascots/monsterArt.ts";
import { MONSTER_COLORS } from "../components/mascots/monsterColors.ts";

/**
 * The artist's blue monster as a standalone SVG string (`monsterArt.ts`, with
 * its colours resolved), framed tightly for small sizes. It's used by the
 * share card, and it's the same art as `src/app/icon.svg`, the browser-tab
 * icon, which `pnpm icons:favicon` writes from it. A test keeps the two
 * identical.
 */
export const MONSTER_ICON_SVG = monsterSvg(MONSTER_COLORS.blue.body, MONSTER_COLORS.blue.iris);

export const MONSTER_ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(MONSTER_ICON_SVG).toString("base64")}`;
