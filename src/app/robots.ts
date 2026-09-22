import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";

export const dynamic = "force-static";

/**
 * `/admin` is the owner's sign-in and dashboard; `/api/` is server routes
 * (checkout, the Stripe webhook, admin actions) — neither has anything a
 * crawler should index or an AI answer engine should read as the site's own
 * words.
 */
const DISALLOW = ["/admin", "/api/"];

/**
 * The AI answer engines named in issue #88, so ChatGPT search, Perplexity,
 * Claude and Google's AI Overviews can be told apart from ordinary search
 * crawling if the rules ever need to diverge — today they share the same
 * disallow list as everyone else. Listed explicitly rather than left to fall
 * through `*` so a crawler checking its own name finds a rule that names it.
 */
const AI_SEARCH_AGENTS = [
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_SEARCH_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${brand.siteUrl}/sitemap.xml`,
    host: brand.siteUrl,
  };
}
