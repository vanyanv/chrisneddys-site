import { describe, expect, it } from "vitest";
import { locations } from "@/data/locations";
import { mapBox } from "@/data/laGeo";
import { shields as allShields } from "@/data/laGeoPaths";
import { PLATES, overlaps, pinBoxes, tagBox, tagSide, type Box } from "./mapLayout";
import { labelBox, placeMapLettering, shieldBox } from "./mapLettering";

const { labels, shields } = placeMapLettering();
const labelBoxes = labels.map((l) => ({ name: l.name, box: labelBox(l.name, l.x, l.y) }));
const shieldBoxes = shields.map((s) => ({ name: s.ref, box: shieldBox(s.x, s.y) }));
const lettering = [...labelBoxes, ...shieldBoxes];

const inside = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= mapBox.w && b.y1 <= mapBox.h;

describe("map lettering", () => {
  it("never puts a street name or shield on a pin, its name, or the open-now tag", () => {
    const pins = locations.flatMap(pinBoxes);
    const tags = locations.filter((l) => l.isOpen).map((l) => tagBox(l));
    for (const { name, box } of lettering) {
      for (const p of [...pins, ...tags]) expect(overlaps(box, p), name).toBe(false);
    }
  });

  it("keeps lettering off the scale bar, attribution and north arrow", () => {
    for (const { name, box } of lettering) {
      for (const p of PLATES) expect(overlaps(box, p), name).toBe(false);
    }
  });

  it("keeps every label and shield fully on the map", () => {
    for (const { name, box } of lettering) expect(inside(box), name).toBe(true);
  });

  it("labels never overlap each other", () => {
    lettering.forEach((a, i) =>
      lettering
        .slice(i + 1)
        .forEach((b) => expect(overlaps(a.box, b.box), `${a.name}/${b.name}`).toBe(false)),
    );
  });

  it("names Sunset Blvd, the street the flagship is on, beside its pin", () => {
    const sunset = labels.find((l) => l.name === "SUNSET BLVD");
    expect(sunset).toBeDefined();
    expect(Math.abs(sunset!.y - 202)).toBeLessThan(1);
  });

  it("keeps every freeway shield", () => {
    expect(shields.map((s) => s.ref).sort()).toEqual(allShields.map((s) => s.ref).sort());
  });
});

describe("open-now tag", () => {
  it("fits on the map at its longest and clears every other pin", () => {
    for (const loc of locations.filter((l) => l.isOpen)) {
      const tag = tagBox(loc);
      expect(inside(tag), loc.id).toBe(true);
      for (const other of locations.filter((l) => l.id !== loc.id)) {
        for (const p of pinBoxes(other)) expect(overlaps(tag, p), other.id).toBe(false);
      }
    }
  });

  it("sits beside the head rather than on it", () => {
    for (const loc of locations.filter((l) => l.isOpen)) {
      const [head] = pinBoxes(loc);
      const tag = tagBox(loc, "OPEN TILL 1 AM");
      expect(overlaps(tag, head!)).toBe(false);
      expect(["right", "left"]).toContain(tagSide(loc));
    }
  });
});
