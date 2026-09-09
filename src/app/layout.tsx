import type { Metadata, Viewport } from "next";
import { Bowlby_One, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";
import { Nav } from "@/components/shared/Nav";
import { Footer } from "@/components/shared/Footer";
import { ScrollVar } from "@/components/shared/ScrollVar";
import { brand } from "@/data/brand";
import { JsonLd } from "@/components/shared/JsonLd";

const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-bowlby",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono-jb",
});

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: `${brand.name} — Smashed sliders in Hollywood`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Two childhood friends, one parking lot, and a smash burger cult following. Smashed sliders on buttered Martin’s potato rolls. Hollywood, Glendale (Spring ’26), Van Nuys (Spring ’26).",
  applicationName: brand.name,
  keywords: [
    "smash burger",
    "sliders",
    "Hollywood burgers",
    "Los Angeles burgers",
    "Chris N Eddy's",
    "Sunset Blvd",
    "late night burgers",
    "fast casual",
  ],
  authors: [{ name: brand.name, url: brand.siteUrl }],
  creator: brand.name,
  publisher: brand.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: brand.siteUrl,
    siteName: brand.name,
    title: `${brand.name} — Smashed sliders in Hollywood`,
    description:
      "Two childhood friends, one parking lot, and a smash burger cult following. Open til 2AM.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name}`,
    description: "Smashed sliders. A 2020 pop-up, on Sunset since 2021.",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#E63027",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <JsonLd />
        <ScrollVar />
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <Script
          defer
          data-domain="chrisneddys.com"
          src="https://plausible.io/js/script.outbound-links.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
