import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["/", "/menu/", "/locations/", "/about/"];
  return paths.map((p, i) => ({
    url: `${brand.siteUrl}${p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: i === 0 ? 1.0 : 0.8,
  }));
}
