import { describe, expect, it } from "vitest";
import { withUtm, storeUrl, itemOrderUrl } from "@/lib/otter";

describe("withUtm", () => {
  it("adds the standard utm params with the given surface as the campaign", () => {
    const url = withUtm("https://order.tryotter.com/s/x", "hero");
    expect(url).toBe(
      "https://order.tryotter.com/s/x?utm_source=site&utm_medium=referral&utm_campaign=hero",
    );
  });

  it("appends with & instead of ? when the url already has a query string", () => {
    const url = withUtm("https://order.tryotter.com/s/x?ref=abc", "dock");
    expect(url).toBe(
      "https://order.tryotter.com/s/x?ref=abc&utm_source=site&utm_medium=referral&utm_campaign=dock",
    );
    // The existing param survives, unmodified.
    expect(url).toContain("ref=abc");
  });

  it("does not double-encode a url that already carries utm params", () => {
    const url = withUtm(`${storeUrl}?utm_source=old`, "header");
    expect(url).toBe(`${storeUrl}?utm_source=old&utm_source=site&utm_medium=referral&utm_campaign=header`);
    expect(url).not.toContain("%3D");
    expect(url).not.toContain("%26");
  });

  it("itemOrderUrl tags the item link with the surface when one is given", () => {
    const url = itemOrderUrl({ name: "Double Slider", otterId: "abc123" }, "menu-item");
    expect(url).toBe(`${storeUrl}/Double%20Slider/abc123?utm_source=site&utm_medium=referral&utm_campaign=menu-item`);
  });

  it("itemOrderUrl leaves the link untagged when no surface is given", () => {
    const url = itemOrderUrl({ name: "Double Slider", otterId: "abc123" });
    expect(url).toBe(`${storeUrl}/Double%20Slider/abc123`);
    expect(url).not.toContain("utm_");
  });
});
