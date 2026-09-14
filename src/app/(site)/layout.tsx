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
import { isShopOpen } from "@/lib/shopStatus";
import { getStoreSettings } from "@/lib/orders";

const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  display: "optional",
  variable: "--font-bowlby",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "optional",
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "optional",
  variable: "--font-mono-jb",
});

const SITE_TITLE = `${brand.name} — Smash Burger Sliders in LA, Open Late`;
const SITE_DESCRIPTION =
  "Smash burger sliders from our Hollywood location — two smashed patties, two slices of cheese, a buttered Martin’s roll, every topping free. Open late.";

export const metadata: Metadata = {
  metadataBase: new URL(brand.siteUrl),
  title: {
    default: SITE_TITLE,
    template: `%s · ${brand.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: brand.name,
  authors: [{ name: brand.name, url: brand.siteUrl }],
  creator: brand.name,
  publisher: brand.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: brand.siteUrl,
    siteName: brand.name,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    // The same line as og:title. A card that says only the brand name where the
    // Facebook one says what the brand sells is a worse card for no reason.
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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

/**
 * Re-checked at most once a minute, the same window the shop pages use for
 * the catalogue — `shopOpen` and `pickupEnabled` below can go stale for up
 * to 60s after an admin flips a setting, never longer, and never requires a
 * redeploy to pick up.
 */
export const revalidate = 60;

/**
 * The storefront's root layout — everything under the `(site)` route group
 * (every page except `/admin`). `/admin` has its own root layout
 * (`src/app/(admin)/layout.tsx`): two root layouts, split by route group,
 * rather than one layout branching on the request path. Branching on
 * `headers()` here previously opted the entire app into dynamic rendering,
 * turning every static/ISR storefront page (`/`, `/shop`, `/menu`, …) into
 * an on-demand server render — a real regression this route-group split
 * undoes.
 *
 * `shopOpen` (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` both set) and
 * `pickupEnabled` (the store settings row) are read here, server-side, and
 * passed down as props to `BagDrawer` — a client component, so it cannot
 * read either itself.
 *
 * `getStoreSettings()` is only called once the shop is actually open. Not
 * just an optimisation: `pickupEnabled` is only ever read inside
 * `BagDrawer`'s `shopOpen` branch, and — unlike `src/lib/catalog.ts` —
 * `src/lib/orders.ts` has no "no `DATABASE_URL`, fall back to the in-repo
 * data" path of its own, so calling it unconditionally here would make
 * *every* page in this layout touch a database (migrating and seeding a
 * fresh local one, on a production build with no `DATABASE_URL` — CI, or a
 * preview deploy that hasn't been given one) purely to render a prop no one
 * reads. Skipping the call keeps that build honest and fast, the same way
 * the shop pages already do for the catalogue itself.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shopOpen = isShopOpen();
  const pickupEnabled = shopOpen ? (await getStoreSettings()).pickupEnabled : false;

  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        {/* Set before first paint so scroll-reveal sections start hidden and
            animate in. Without it they would flash visible, then hide. */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        <Analytics />
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
        <script dangerouslySetInnerHTML={{ __html: REVEAL_ABOVE_FOLD }} />
        <SiteFooter />
        {/* Sitewide, because the bag is: someone who put a cap in it and then
            wandered off to the menu should still be able to open it. Renders
            no DOM at all until it is opened. */}
        <BagDrawer shopOpen={shopOpen} pickupEnabled={pickupEnabled} />
        <OrderDock />
        <Script
          defer
          data-domain="chrisneddys.com"
          src="https://plausible.io/js/script.outbound-links.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
