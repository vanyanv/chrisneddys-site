import { describe, expect, it } from "vitest";
import { editionFlag, shippingReturnsNote } from "@/lib/shopCopy";
import type { StoreSettings } from "@/lib/orders";

describe("editionFlag", () => {
  it("reads 'ONLY N MADE' for a tracked edition size", () => {
    expect(editionFlag(50)).toBe("ONLY 50 MADE");
    expect(editionFlag(1)).toBe("ONLY 1 MADE");
  });

  it("reads 'LIMITED RUN' when there's no edition size to back a number", () => {
    expect(editionFlag(null)).toBe("LIMITED RUN");
  });
});

const base: StoreSettings = {
  id: "default",
  storeName: "Chris N Eddy's",
  supportEmail: "shop@chrisneddys.com",
  pickupEnabled: true,
  pickupAddress: "5539 W. Sunset Blvd.",
  shippingFlatCents: 600,
  shippingFreeOverCents: 7500,
  shipCountries: ["US"],
  returnsPolicy: "Returns accepted within 14 days of delivery, unworn and in original packaging.",
  termsText: "All sales are final once an edition ships.",
  updatedAt: new Date("2026-09-01T00:00:00Z"),
};

describe("shippingReturnsNote", () => {
  it("returns null when there's no returns policy set yet", () => {
    expect(shippingReturnsNote({ ...base, returnsPolicy: null })).toBeNull();
    expect(shippingReturnsNote({ ...base, returnsPolicy: "   " })).toBeNull();
  });

  it("composes flat rate, free-over threshold and pickup, in order", () => {
    const note = shippingReturnsNote(base);
    expect(note).not.toBeNull();
    expect(note!.line).toBe(
      "Ships flat $6 in the US · free over $75 · or pick up at 5539 W. Sunset Blvd..",
    );
  });

  it("flags hasTerms only when termsText is set", () => {
    expect(shippingReturnsNote(base)!.hasTerms).toBe(true);
    expect(shippingReturnsNote({ ...base, termsText: null })!.hasTerms).toBe(false);
    expect(shippingReturnsNote({ ...base, termsText: "  " })!.hasTerms).toBe(false);
  });

  it("omits the free-over clause when there's no threshold", () => {
    const note = shippingReturnsNote({ ...base, shippingFreeOverCents: null });
    expect(note!.line).toBe("Ships flat $6 in the US · or pick up at 5539 W. Sunset Blvd..");
  });

  it("omits the pickup clause when pickup is disabled", () => {
    const note = shippingReturnsNote({ ...base, pickupEnabled: false });
    expect(note!.line).toBe("Ships flat $6 in the US · free over $75.");
  });

  it("omits the pickup clause when the pickup address is blank", () => {
    const note = shippingReturnsNote({ ...base, pickupAddress: "   " });
    expect(note!.line).toBe("Ships flat $6 in the US · free over $75.");
  });

  it("says 'to <countries>' instead of 'in the US' once ship-to isn't just the US", () => {
    const note = shippingReturnsNote({ ...base, shipCountries: ["US", "CA"] });
    expect(note!.line.startsWith("Ships flat $6 to US, CA")).toBe(true);
  });

  it("collapses a multi-line pickup address onto one line", () => {
    const note = shippingReturnsNote({
      ...base,
      pickupAddress: "5539 W. Sunset Blvd\nLos Angeles, CA 90028",
      shippingFreeOverCents: null,
    });
    expect(note!.line).toBe(
      "Ships flat $6 in the US · or pick up at 5539 W. Sunset Blvd, Los Angeles, CA 90028.",
    );
  });

  it("formats a non-round flat rate with cents", () => {
    const note = shippingReturnsNote({
      ...base,
      shippingFlatCents: 675,
      shippingFreeOverCents: null,
    });
    expect(note!.line.startsWith("Ships flat $6.75 in the US")).toBe(true);
  });
});
