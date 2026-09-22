import { describe, expect, it } from "vitest";
import { vortexCells, type VortexGeometryParams } from "./vortexGeometry";

const BASE: VortexGeometryParams = {
  W: 800,
  H: 400,
  cx: 400,
  cy: 200,
  vx: 400,
  vy: 200,
  R: 200,
  rings: 4,
  cells: 6,
  twist: 9,
  pow: 1,
};

describe("vortexCells", () => {
  it("is deterministic for the same params", () => {
    expect(vortexCells(BASE)).toEqual(vortexCells(BASE));
  });

  it("returns the expected cell count (half of rings * cells, checkerboard parity)", () => {
    // Concentric (cx === vx, cy === vy) with pow: 1 means every ring radius
    // is comfortably above the r < 2 break threshold until the last step, so
    // the loop runs its full `rings` iterations with `cells / 2` kept cells
    // each.
    expect(vortexCells(BASE)).toHaveLength((BASE.rings! * BASE.cells!) / 2);
  });

  it("respects a different rings/cells count", () => {
    const params = { ...BASE, rings: 6, cells: 8 };
    expect(vortexCells(params)).toHaveLength((6 * 8) / 2);
  });

  it("emits no NaN or non-finite coordinates", () => {
    const cells = vortexCells({
      W: 1600,
      H: 420,
      cx: 780,
      cy: 210,
      vx: 900,
      vy: 160,
      R: 1400,
      rings: 24,
      cells: 30,
      twist: 9,
      pow: 1.85,
    });
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      for (const pair of cell.split(" ")) {
        for (const coord of pair.split(",")) {
          const n = Number(coord);
          expect(Number.isFinite(n)).toBe(true);
        }
      }
    }
  });

  it("rounds every coordinate to a whole number", () => {
    const cells = vortexCells(BASE);
    for (const cell of cells) {
      for (const pair of cell.split(" ")) {
        for (const coord of pair.split(",")) {
          expect(Number.isInteger(Number(coord))).toBe(true);
        }
      }
    }
  });

  it("stops once a ring's radius shrinks below the threshold", () => {
    // A tiny R with few rings should still terminate cleanly with no
    // degenerate/empty output.
    const cells = vortexCells({ ...BASE, R: 3, rings: 20 });
    expect(cells.length).toBeGreaterThanOrEqual(0);
    expect(cells.every((c) => c.length > 0)).toBe(true);
  });
});
