import { afterEach, describe, expect, it, vi } from "vitest";
import { GLENDALE_OPENS_AT, hasPassed, locations } from "./locations";
import { sharedFaq } from "./faq";
import { siteDescription } from "@/lib/seo";
import { buildLlmsTxt } from "@/lib/llmsTxt";
import { closingSummary, openingLabel, storeStatus } from "@/lib/hours";
import { openLocations, openNames } from "@/lib/openLocations";
import { dueOpeningMoment } from "@/lib/openingRefresh";
import { merch } from "./merch";

const vanNuys = () => locations.find((l) => l.id === "vannuys")!;
const glendale = () => locations.find((l) => l.id === "glendale")!;
const orderFaq = () => sharedFaq.find((f) => f.q.includes("Van Nuys"))!.a;

/** Pins the clock, in LA time, for one test. */
function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Van Nuys is open, the same as Hollywood", () => {
  it("is open, with hours and a live status", () => {
    at("2026-10-24T12:00:00-07:00");
    const vn = vanNuys();
    expect(vn.isOpen).toBe(true);
    expect(vn.status).toBe("Open daily");
    expect(vn.openingSpec).toHaveLength(2);
    expect(closingSummary(vn)).not.toBe("");
    expect(storeStatus(vn, new Date("2026-09-30T20:00:00Z")).state).toBe("open");
    expect(siteDescription()).toContain("Hollywood and Van Nuys now, Glendale soon.");
    expect(orderFaq()).toMatch(/^Van Nuys, yes/);
  });

  it("is in llms.txt as open, with its own phone", () => {
    at("2026-10-24T12:00:00-07:00");
    const text = buildLlmsTxt(merch);
    expect(text).toContain("on Sherman Way in Van Nuys");
    expect(text).toContain(vanNuys().phone!);
    expect(text).not.toContain("the other locations have not opened yet");
  });
});

describe("Glendale opens by itself at 6 PM Friday, Oct 30 (LA time)", () => {
  it("is the moment on the owner's flyer", () => {
    expect(Date.parse(GLENDALE_OPENS_AT)).toBe(Date.parse("2026-10-31T01:00:00Z"));
  });

  it("is a dated coming-soon store a minute before", () => {
    at("2026-10-30T17:59:00-07:00");
    const g = glendale();
    expect(hasPassed(GLENDALE_OPENS_AT)).toBe(false);
    expect(g.isOpen).toBe(false);
    expect(g.openingAnnouncement).toBe("Grand opening Friday, Oct 30 at 6 PM");
    expect(g.status).toBe("Grand opening Friday, Oct 30 at 6 PM");
    expect(g.openingSpec).toBeUndefined();
    expect(closingSummary(g)).toBe("");
    expect(openingLabel(g)).toBe("OPENS FRI 6 PM");
    expect(openNames()).toBe("Hollywood and Van Nuys");
    expect(siteDescription()).toContain("Glendale soon.");
    expect(orderFaq()).toContain("Glendale opens Friday, Oct 30 at 6 PM.");
  });

  it("shows its hours from midnight on opening day, before the doors open", () => {
    const from = Date.parse(glendale().showHoursFrom!);
    expect(from).toBe(Date.parse("2026-10-30T07:00:00Z"));
    expect(from).toBeLessThan(Date.parse(GLENDALE_OPENS_AT));
  });

  it("is open, with hours and a live status, from 6 PM", () => {
    at("2026-10-30T18:00:00-07:00");
    const g = glendale();
    expect(g.isOpen).toBe(true);
    expect(g.openingAnnouncement).toBeUndefined();
    expect(g.opensAt).toBeUndefined();
    expect(g.status).toBe("Open daily");
    expect(g.sub).toBe("Now open");
    expect(g.openingSpec).toHaveLength(2);
    // Friday night: open until 2 AM.
    expect(storeStatus(g, new Date()).state).toBe("open");
    expect(closingSummary(g)).toBe(closingSummary(vanNuys()));
    expect(openLocations().map((l) => l.id)).toEqual(["hollywood", "glendale", "vannuys"]);
    expect(siteDescription()).toContain("Hollywood, Van Nuys and Glendale.");
    expect(orderFaq()).toMatch(/^Yes — both are open/);
  });

  it("is in llms.txt as a dated store before, and as open after", () => {
    at("2026-10-29T12:00:00-07:00");
    const before = buildLlmsTxt(merch);
    expect(before).toContain("Glendale has its grand opening Friday, Oct 30 at 6 PM.");
    expect(before).toContain("Status: Grand opening Friday, Oct 30 at 6 PM.");
    expect(before).toContain("- Address: 1360 E Colorado St, Glendale, CA 91205");

    at("2026-10-30T18:05:00-07:00");
    const after = buildLlmsTxt(merch);
    expect(after).toContain("on Colorado St in Glendale");
    expect(after).not.toMatch(/grand opening/i);
    const start = after.indexOf("### Glendale");
    expect(after.slice(start, after.indexOf("\n### ", start + 1))).toContain("Status: open now.");
  });
});

describe("the /api/opening cron re-renders the site only at the opening moments", () => {
  it("is due at midnight on opening day and at the 6 PM doors", () => {
    expect(dueOpeningMoment(Date.parse("2026-10-30T00:00:30-07:00"))).toBe(
      "2026-10-30T00:00:00-07:00",
    );
    expect(dueOpeningMoment(Date.parse("2026-10-30T18:00:30-07:00"))).toBe(GLENDALE_OPENS_AT);
    // A Hobby-plan cron can land late in its hour.
    expect(dueOpeningMoment(Date.parse("2026-10-30T18:59:00-07:00"))).toBe(GLENDALE_OPENS_AT);
  });

  it("does nothing any other time", () => {
    expect(dueOpeningMoment(Date.parse("2026-10-30T17:59:00-07:00"))).toBeNull();
    expect(dueOpeningMoment(Date.parse("2026-10-30T20:00:00-07:00"))).toBeNull();
    expect(dueOpeningMoment(Date.parse("2026-10-24T12:00:00-07:00"))).toBeNull();
    expect(dueOpeningMoment(Date.parse("2027-10-30T18:00:30-07:00"))).toBeNull();
  });
});
