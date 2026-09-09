import type { Metadata, Viewport } from "next";
import { Bowlby_One, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";
import "@/styles/counter.css";
import { SiteHeader } from "@/components/counter/SiteHeader";
import { SiteFooter } from "@/components/counter/SiteFooter";
import { OrderDock } from "@/components/counter/OrderDock";
import { LastCall } from "@/components/counter/LastCall";
import { NightMode } from "@/components/counter/NightMode";
import { RevealRoot } from "@/components/counter/Reveal";
import { brand } from "@/data/brand";
import { JsonLd } from "@/components/shared/JsonLd";
import { OG_IMAGE } from "@/lib/seo";
import { Analytics } from "@/components/shared/Analytics";

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
    default: `${brand.name} — Smash Burger Sliders in Hollywood, LA`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Smashed sliders in Hollywood, open till 1AM. Two patties, two slices of cheese, a buttered Martin’s roll. Order Chris’s Way or Eddy’s Way — every topping free.",
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
    title: `${brand.name} — Smash Burger Sliders in Hollywood, LA`,
    description: "Smashed sliders in Hollywood, open till 1AM. Two patties, two slices of cheese, a buttered Martin’s roll. Order Chris’s Way or Eddy’s Way — every topping free.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name}`,
    description: "Smashed sliders in Hollywood, open till 1AM. Two patties, two slices of cheese, a buttered Martin’s roll. Order Chris’s Way or Eddy’s Way — every topping free.",
    images: [OG_IMAGE.url],
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
        {/* Set before first paint so scroll-reveal sections start hidden and
            animate in. Without it they would flash visible, then hide. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        <JsonLd />
        <NightMode />
        <RevealRoot />
        <SiteHeader />
        <LastCall />
        <main id="main">{children}</main>
        <SiteFooter />
        <OrderDock />
        <Script
          defer
          data-domain="chrisneddys.com"
          src="https://plausible.io/js/script.outbound-links.js"
          strategy="afterInteractive"
        />
        <Analytics />
      </body>
    </html>
  );
}
