import { describe, expect, it } from "vitest";
import { clickLocation, normaliseLocation, otterStoreId } from "@/lib/clickLocation";
import { itemOrderUrl, orderUrl, withUtm } from "@/lib/otter";
import { locations } from "@/data/locations";

const vanNuys = locations.find((l) => l.id === "vannuys")!;
const hollywood = locations.find((l) => l.id === "hollywood")!;

describe("clickLocation", () => {
  it("reads the store from an Otter storefront link, whatever the button declares", () => {
    expect(clickLocation(orderUrl("hero"))).toBe("hollywood");
    expect(clickLocation(withUtm(vanNuys.orderUrl!, "header"), "hollywood")).toBe("van-nuys");
  });

  it("reads the store from an Otter item link", () => {
    expect(clickLocation(itemOrderUrl({ name: "Slider", otterId: "abc" }, "menu-item"))).toBe(
      "hollywood",
    );
  });

  it("reads the store from a store's own phone number", () => {
    expect(clickLocation(`tel:${vanNuys.phoneTel}`)).toBe("van-nuys");
    expect(clickLocation(`tel:${hollywood.phoneTel}`)).toBe("hollywood");
  });

  it("falls back to the declared store for links that don't name one", () => {
    expect(clickLocation("https://www.google.com/maps/dir/?api=1&destination=x", "van-nuys")).toBe(
      "van-nuys",
    );
    expect(clickLocation("https://www.doordash.com/store/x/")).toBeUndefined();
  });

  it("spells a declared store id as its URL slug, so one store is one row", () => {
    expect(clickLocation("https://maps.apple.com/?daddr=x", "vannuys")).toBe("van-nuys");
    expect(normaliseLocation("vannuys")).toBe("van-nuys");
    expect(normaliseLocation("glendale")).toBe("glendale");
    expect(normaliseLocation(undefined)).toBeUndefined();
  });

  it("ignores URLs that aren't Otter storefronts", () => {
    expect(otterStoreId(new URL("https://order.tryotter.com/"))).toBeUndefined();
    expect(otterStoreId(new URL("https://example.com/s/a/b/c"))).toBeUndefined();
  });
});
