import { NextResponse } from "next/server";
import { listPublishedProducts } from "@/lib/catalog";
import { buildLlmsTxt } from "@/lib/llmsTxt";

/**
 * Static, same as `src/app/robots.ts` and `src/app/sitemap.ts` — this route
 * has no per-visitor state, so it is generated at build time rather than on
 * every request. `listPublishedProducts()` already falls back to the in-repo
 * `merch` array when there is no database to read (see `src/lib/catalog.ts`),
 * exactly what the sitemap relies on, so this route builds cleanly with no
 * `DATABASE_URL` set too.
 */
export const dynamic = "force-static";

export async function GET() {
  const products = await listPublishedProducts();
  return new NextResponse(buildLlmsTxt(products), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
