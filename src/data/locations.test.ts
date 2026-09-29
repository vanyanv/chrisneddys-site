import { describe, expect, it } from "vitest";
import { locations } from "./locations";
import { sharedFaq } from "./faq";
import { siteDescription } from "@/lib/seo";
import { buildLlmsTxt } from "@/lib/llmsTxt";
import { closingSummary, storeStatus } from "@/lib/hours";
import { merch } from "./merch";

const vanNuys = () => locations.find((l) => l.id === "vannuys")!;

describe("Van Nuys is open, the same as Hollywood", () => {
  it("is open, with hours and a live status", () => {
    const vn = vanNuys();
    expect(vn.isOpen).toBe(true);
    expect(vn.status).toBe("Open daily");
    expect(vn.openingSpec).toHaveLength(2);
    expect(closingSummary(vn)).not.toBe("");
    expect(storeStatus(vn, new Date("2026-09-30T20:00:00Z")).state).toBe("open");
    expect(siteDescription()).toContain("Hollywood and Van Nuys now, Glendale soon.");
    expect(sharedFaq.find((f) => f.q.includes("Van Nuys"))!.a).toMatch(/^Van Nuys, yes/);
  });

  it("is in llms.txt as open, with its own phone and no opening date", () => {
    const text = buildLlmsTxt(merch);
    expect(text).toContain("on Sherman Way in Van Nuys");
    expect(text).not.toMatch(/grand opening/i);
    expect(text).toContain(vanNuys().phone!);
    expect(text).not.toContain("the other locations have not opened yet");
  });

  it("leaves Glendale coming soon", () => {
    const glendale = locations.find((l) => l.id === "glendale")!;
    expect(glendale.isOpen).toBe(false);
  });
});
