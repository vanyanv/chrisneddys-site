import type { MetadataRoute } from "next";
import { brand } from "@/data/brand";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — Smashed sliders in Hollywood`,
    short_name: brand.name,
    description:
      "Smashed sliders on buttered Martin's potato rolls. Hollywood, Glendale, Van Nuys.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF2C9",
    theme_color: "#E63027",
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops a maskable icon to its own shape, so it needs the mark
      // inside the safe circle. The wordmark already sits well within it — it
      // spans the middle 65% of the canvas on cream — so the same file serves.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
