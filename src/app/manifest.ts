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
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
