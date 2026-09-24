import { describe, expect, it } from "vitest";
import { tunnelPath } from "./tunnelPath";

describe("tunnelPath", () => {
  const d = tunnelPath();

  it("draws every checker cell as a closed subpath with whole-number points", () => {
    expect(d).toMatch(/^M-?\d+,-?\d+(L-?\d+,-?\d+)+Z/);
    expect(d).not.toMatch(/\d\.\d/);
    expect(d.split("Z").filter(Boolean).length).toBeGreaterThan(100);
  });
});
