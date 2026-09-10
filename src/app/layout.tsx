import type { Metadata, Viewport } from "next";
import { Bowlby_One, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";
import "@/styles/counter.css";
import { SiteHeader } from "@/components/counter/SiteHeader";
import { SiteFooter } from "@/components/counter/SiteFooter";
import { OrderDock } from "@/components/counter/OrderDock";
import { LastCall } from "@/components/counter/LastCall";
import { RevealRoot } from "@/components/counter/Reveal";
import { BagDrawer } from "@/components/shop/BagDrawer";
import { brand } from "@/data/brand";
import { JsonLd } from "@/components/shared/JsonLd";
import { OG_IMAGE } from "@/lib/seo";
import { Analytics } from "@/components/shared/Analytics";
import { TrackEvents } from "@/components/shared/TrackEvents";

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
    default: `${brand.name} — Smash Burger Sliders in LA, Open Late`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Smash burger sliders from our Hollywood counter — two smashed patties, two slices of cheese, a buttered Martin’s roll, every topping free. Open late.",
  applicationName: brand.name,
  keywords: [
    "smash burger",
    "sliders",
    "Hollywood burgers",
    "Los Angeles burgers",
    "best burgers in Los Angeles",
    "Chris N Eddy's",
    "Sunset Blvd",
    "late night burgers",
    "burgers near me",
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
    title: `${brand.name} — Smash Burger Sliders in LA, Open Late`,
    description: "Smash burger sliders from our Hollywood counter — two smashed patties, two slices of cheese, a buttered Martin’s roll, every topping free. Open late.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name}`,
    description: "Smash burger sliders from our Hollywood counter — two smashed patties, two slices of cheese, a buttered Martin’s roll, every topping free. Open late.",
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

/** Mirrors the stagger RevealRoot applies, so the two agree on the first frame. */
const REVEAL_ABOVE_FOLD = `(function(){try{var n=document.querySelectorAll('.cne-rv'),h=window.innerHeight,i,e;for(i=0;i<n.length;i++){e=n[i];if(e.getBoundingClientRect().top<h){e.style.transitionDelay=(i%4)*60+'ms';e.classList.add('is-in')}}}catch(_){}})()`;

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
        <RevealRoot />
        <TrackEvents />
        <SiteHeader />
        <LastCall />
        <main id="main">{children}</main>
        {/* Reveal what is already on screen while the HTML is still parsing.
            RevealRoot does the same sweep, but only once React has hydrated —
            on a throttled phone that is ~3s after first paint, and the section
            holding the largest text sits at opacity 0 for all of it, which is
            what the browser reports as LCP. The transition still runs, so the
            animation is unchanged; it just starts when the page does. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: REVEAL_ABOVE_FOLD }}
        />
        <SiteFooter />
        {/* Sitewide, because the bag is: someone who put a cap in it and then
            wandered off to the menu should still be able to open it. Renders
            no DOM at all until it is opened. */}
        <BagDrawer />
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
