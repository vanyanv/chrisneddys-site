import { describe, expect, it } from "vitest";
import {
  joinRequirements,
  missingPublishRequirements,
  PUBLISH_REQUIREMENT_MESSAGES,
} from "@/lib/publishRequirements";

// The pure predicate `setStatus` (`@/lib/catalogAdmin`) and the rack panel's
// live "what's still needed" checklist (`RackProductPanel.tsx`) both key off
// of (issue #45) — `catalogAdmin.test.ts`'s `setStatus` tests already
// exercise it indirectly through every publish-gate case; these cover the
// pure functions directly, including the ordering guarantee nothing there
// pins explicitly.
describe("missingPublishRequirements", () => {
  const ready = { hasName: true, hasPrice: true, hasRunSize: true, hasPhoto: true };

  it("is empty once every requirement is met", () => {
    expect(missingPublishRequirements(ready)).toEqual([]);
  });

  it("lists every unmet requirement, not just the first", () => {
    expect(missingPublishRequirements({ ...ready, hasName: false, hasPhoto: false })).toEqual([
      "name",
      "photo",
    ]);
  });

  it("always orders results name, price, run, photo, regardless of input order", () => {
    expect(
      missingPublishRequirements({
        hasPhoto: false,
        hasRunSize: false,
        hasPrice: false,
        hasName: false,
      }),
    ).toEqual(["name", "price", "run", "photo"]);
  });
});

describe("PUBLISH_REQUIREMENT_MESSAGES", () => {
  it("has one, distinct message per requirement key", () => {
    const messages = Object.values(PUBLISH_REQUIREMENT_MESSAGES);
    expect(messages).toHaveLength(4);
    expect(new Set(messages).size).toBe(4);
  });
});

describe("joinRequirements", () => {
  it("returns an empty string for nothing missing", () => {
    expect(joinRequirements([])).toBe("");
  });

  it("returns a bare noun for exactly one", () => {
    expect(joinRequirements(["name"])).toBe("a name");
  });

  it("joins two with 'and', no comma", () => {
    expect(joinRequirements(["name", "photo"])).toBe("a name and a photo");
  });

  it("joins three or more with commas and a trailing 'and'", () => {
    expect(joinRequirements(["name", "price", "photo"])).toBe("a name, a price and a photo");
    expect(joinRequirements(["name", "price", "run", "photo"])).toBe(
      "a name, a price, a run size and a photo",
    );
  });
});
