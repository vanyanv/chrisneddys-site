import { describe, expect, it } from "vitest";
import {
  editionFlag,
  pauseButtonLabel,
  pauseCheckoutMessage,
  pauseNotice,
  shippingReturnsNote,
} from "@/lib/shopCopy";
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
  shopPaused: false,
  pauseNote: null,
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

// issue #43 — the "shop paused" copy, kept deliberately separate from the
// pre-launch (`TERMS_PENDING`) copy above: see `shopStatus.ts`'s
// `isShopPausedFor` for why the two states are never merged.
describe("pauseNotice", () => {
  it("holds together as one sentence-flow with no note set", () => {
    const notice = pauseNotice(null);
    expect(notice.heading).toBe("The shop's shut for a couple of days.");
    expect(notice.body).toBe(
      "We're restocking the counter and nobody's here to pack boxes. Your number will still be there.",
    );
  });

  it("folds the owner's note into the fixed sentence, not in place of it", () => {
    const notice = pauseNotice("Back Thursday");
    expect(notice.body).toBe(
      "We're restocking the counter and nobody's here to pack boxes. Back Thursday. Your number will still be there.",
    );
  });

  it("trims the note and treats a blank one the same as no note", () => {
    expect(pauseNotice("   ").body).toBe(pauseNotice(null).body);
    expect(pauseNotice("  Back Thursday  ").body).toBe(pauseNotice("Back Thursday").body);
  });
});

describe("pauseButtonLabel", () => {
  it("falls back to SHOP PAUSED with no note set", () => {
    expect(pauseButtonLabel(null)).toBe("SHOP PAUSED");
    expect(pauseButtonLabel("   ")).toBe("SHOP PAUSED");
  });

  it("uppercases the owner's own note for the disabled button", () => {
    expect(pauseButtonLabel("Back Thursday")).toBe("BACK THURSDAY");
  });
});

describe("pauseCheckoutMessage", () => {
  it("reads as a short, distinct message from the pre-launch one", () => {
    const message = pauseCheckoutMessage(null);
    expect(message).toContain("paused");
    expect(message).not.toContain("isn't open yet");
  });

  it("includes the owner's note when set", () => {
    expect(pauseCheckoutMessage("Back Thursday")).toContain("Back Thursday");
  });
});
