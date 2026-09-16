import { describe, expect, it } from "vitest";
import { customerFacingProductName } from "@/lib/productName";

describe("customerFacingProductName", () => {
  it("joins the two display lines, which is what the shop shows", () => {
    expect(
      customerFacingProductName({
        displayName1: "THE FOAM TRUCKER",
        displayName2: "— BLUE",
        name: "Foam Trucker",
      }),
    ).toBe("THE FOAM TRUCKER — BLUE");
  });

  it("falls back to the legacy name when there are no display lines", () => {
    expect(
      customerFacingProductName({ displayName1: "", displayName2: "", name: "Foam Trucker" }),
    ).toBe("Foam Trucker");
  });

  it("uses the display lines even when the legacy name is empty", () => {
    // The Rack's "New product" creates a draft with an EMPTY `name` and its
    // panel only ever writes `displayName1`/`displayName2`, so this is the
    // shape of every product created in the current admin. Snapshotting
    // `name` here is what put blank item names on real orders (issue #41).
    expect(
      customerFacingProductName({ displayName1: "THE DEMO CAP", displayName2: "", name: "" }),
    ).toBe("THE DEMO CAP");
  });

  it("never returns an empty string, because a snapshot has to say something", () => {
    expect(customerFacingProductName({ displayName1: "", displayName2: "", name: "" })).toBe(
      "Untitled product",
    );
    expect(customerFacingProductName({})).toBe("Untitled product");
  });

  it("ignores whitespace-only values", () => {
    expect(customerFacingProductName({ displayName1: "   ", displayName2: "", name: "  " })).toBe(
      "Untitled product",
    );
  });
});
