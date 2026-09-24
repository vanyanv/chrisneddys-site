import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPassed, locations, VAN_NUYS_OPENS_AT } from "./locations";
import { sharedFaq } from "./faq";
import { siteDescription } from "@/lib/seo";
import { buildLlmsTxt } from "@/lib/llmsTxt";
import { closingSummary, storeStatus } from "@/lib/hours";
import { merch } from "./merch";

const vanNuys = () => locations.find((l) => l.id === "vannuys")!;

/** Pins the clock, in LA time, for one test. */
function at(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Van Nuys opens by itself at 6 PM Friday, Sept 25 (LA time)", () => {
  it("is the moment the owner gave", () => {
    expect(Date.parse(VAN_NUYS_OPENS_AT)).toBe(Date.parse("2026-09-26T01:00:00Z"));
  });

  it("is a dated coming-soon store a minute before", () => {
    at("2026-09-25T17:59:00-07:00");
    const vn = vanNuys();
    expect(hasPassed(VAN_NUYS_OPENS_AT)).toBe(false);
    expect(vn.isOpen).toBe(false);
    expect(vn.openingAnnouncement).toBe("Grand opening Friday, Sept 25 at 6 PM");
    expect(vn.openingSpec).toBeUndefined();
    expect(closingSummary(vn)).toBe("");
    expect(siteDescription()).toContain("Hollywood now, Glendale and Van Nuys soon.");
    expect(sharedFaq.find((f) => f.q.includes("Van Nuys"))!.a).toMatch(/^Not yet/);
  });

  it("is open, with hours and a live status, from 6 PM", () => {
    at("2026-09-25T18:00:00-07:00");
    const vn = vanNuys();
    expect(vn.isOpen).toBe(true);
    expect(vn.openingAnnouncement).toBeUndefined();
    expect(vn.status).toBe("Open daily");
    expect(vn.openingSpec).toHaveLength(2);
    expect(closingSummary(vn)).not.toBe("");
    expect(storeStatus(vn, new Date()).state).toBe("open");
    expect(siteDescription()).toContain("Hollywood and Van Nuys now, Glendale soon.");
    expect(sharedFaq.find((f) => f.q.includes("Van Nuys"))!.a).toMatch(/^Van Nuys, yes/);
  });

  it("puts Van Nuys in llms.txt as open, with its own order link", () => {
    at("2026-09-25T18:05:00-07:00");
    const text = buildLlmsTxt(merch);
    expect(text).toContain("on Sherman Way in Van Nuys");
    expect(text).not.toContain("grand opening Friday");
    expect(text).toContain(vanNuys().phone!);
    expect(text).not.toContain("the other locations have not opened yet");
  });

  it("leaves Glendale coming soon", () => {
    at("2026-09-26T12:00:00-07:00");
    const glendale = locations.find((l) => l.id === "glendale")!;
    expect(glendale.isOpen).toBe(false);
  });
});
