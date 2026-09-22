import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { brand } from "@/data/brand";

describe("robots", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  it("keeps the default rule allowing everything but /admin and /api/", () => {
    const wildcard = rules.find((r) => r.userAgent === "*");
    expect(wildcard).toBeDefined();
    expect(wildcard!.allow).toBe("/");
    expect(wildcard!.disallow).toEqual(["/admin", "/api/"]);
  });

  it("names every AI search crawler from issue #88 with the same disallow list", () => {
    const aiAgents = [
      "OAI-SearchBot",
      "ChatGPT-User",
      "GPTBot",
      "PerplexityBot",
      "Perplexity-User",
      "ClaudeBot",
      "Claude-SearchBot",
      "Claude-User",
      "Google-Extended",
      "Applebot-Extended",
    ];
    for (const agent of aiAgents) {
      const rule = rules.find((r) => r.userAgent === agent);
      expect(rule, `expected a rule for ${agent}`).toBeDefined();
      expect(rule!.allow).toBe("/");
      expect(rule!.disallow).toEqual(["/admin", "/api/"]);
    }
  });

  it("keeps the sitemap and host pointed at the live site", () => {
    expect(result.sitemap).toBe(`${brand.siteUrl}/sitemap.xml`);
    expect(result.host).toBe(brand.siteUrl);
  });
});
