import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONSTER_ICON_SVG } from "./monsterIcon";

describe("monster icon", () => {
  it("matches the browser-tab icon file", () => {
    const file = readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8");
    expect(file.replace(/<!--[\s\S]*?-->\n/g, "").trim()).toBe(MONSTER_ICON_SVG);
  });
});
