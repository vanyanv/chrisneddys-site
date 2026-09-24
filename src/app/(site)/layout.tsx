import type { Metadata, Viewport } from "next";
import { Bowlby_One, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "@/styles/globals.css";
import "@/styles/counter.css";
import "@/styles/mascots.css";
import "@/styles/chrome-art.css";
import { MascotDefs } from "@/components/mascots/MascotDefs";
import { SiteHeader } from "@/components/counter/SiteHeader";
import { SiteFooter } from "@/components/counter/SiteFooter";
import { OrderDock } from "@/components/counter/OrderDock";
import { LastCall } from "@/components/counter/LastCall";
import { RevealRoot } from "@/components/counter/Reveal";
import { BagDrawer } from "@/components/shop/BagDrawer";
import { brand } from "@/data/brand";
import { JsonLd } from "@/components/shared/JsonLd";
import { OG_IMAGE, siteDescription } from "@/lib/seo";
import { Analytics } from "@/components/shared/Analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TrackEvents } from "@/components/shared/TrackEvents";
import { PrefetchNav } from "@/components/counter/PrefetchNav";
import { BackToTop } from "@/components/storeart/BackToTop";
import { SlideCode } from "@/components/storeart/SlideCode";
import { hasPaymentKeys, isShopOpenFor } from "@/lib/shopStatus";
import { getPublicStoreSettings } from "@/lib/orders";
import { shippingReturnsNote } from "@/lib/shopCopy";
import { TERMS_PENDING } from "@/data/merch";

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

/**
 * Not part of DESIGN.md's three-typeface system — used only for the graffiti
 * eyebrows (`.cne-eyebrow`), the small "SLIDERS"/"Slide or Die" footer
 * signature, and the sleeping badge's "z". Exposed as its own CSS variable
 * so it stays scoped to those classes instead of leaking into the shared
 * type system.
 *
 * Loaded from a local subset (issue #87) instead of next/font/google's full
 * Permanent Marker latin file (29 KB, preloaded ahead of the page's LCP
 * image on every route even though the font paints small decorative text).
 * The subset covers Basic Latin printable (U+0020-007E) plus the curly
 * quotes/dashes/middle dot the copy actually uses (’ — · and their pairs
 * ‘ – " "), since `.cne-eyebrow` is not forced to a single case — see
 * scripts/subset-marker-font.sh for the exact command, source file and
 * reasoning, and re-run it if new punctuation shows up in owner-edited copy.
 * At ~18 KB it's still small enough to preload without hurting LCP.
 */
const marker = localFont({
  src: "../../fonts/permanent-marker-subset.woff2",
  weight: "400",
  style: "normal",
  display: "optional",
  preload: true,
  adjustFontFallback: "Arial",
  variable: "--font-marker",
});

// Home page title, and the line link previews show. Kept under ~60 characters
// so Google shows it whole; other pages use the template below.
const SITE_TITLE = `${brand.name} | ${brand.tagline}: Sliders, Shakes & Fries`;

// A function rather than a constant: the description changes by itself when
// Van Nuys opens (`siteDescription`), and this layout regenerates every minute.
export function generateMetadata(): Metadata {
  const description = siteDescription();
  return {
    metadataBase: new URL(brand.siteUrl),
    title: {
      default: SITE_TITLE,
      template: `%s · ${brand.name}`,
    },
    description,
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
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      // The same line as og:title. A card that says only the brand name where the
      // Facebook one says what the brand sells is a worse card for no reason.
      title: SITE_TITLE,
      description,
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
}

/**
 * Mirrors the stagger RevealRoot applies, so the two agree on the first frame.
 *
 * Every position is read before any section is touched. Reading one, then
 * adding `is-in`, then reading the next made the browser lay the whole page
 * out again for each section: about a quarter of a second of a throttled
 * phone's main thread, spent while the page was still being parsed.
 */
const REVEAL_ABOVE_FOLD = `(function(){try{var n=document.querySelectorAll('.cne-rv'),h=window.innerHeight,t=[],i;for(i=0;i<n.length;i++)t.push(n[i].getBoundingClientRect().top);for(i=0;i<n.length;i++){if(t[i]<h){n[i].style.transitionDelay=(i%4)*60+'ms';n[i].classList.add('is-in')}}}catch(_){}})()`;

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
 * `shopOpen` (`isShopOpenFor(settings)` — Stripe keys, a published returns
 * policy, and a support email all set) and `pickupEnabled` (the store
 * settings row) are read here, server-side, and passed down as props to
 * `BagDrawer` — a client component, so it cannot read either itself.
 * `shippingNote` is the "Shipping & returns" line (or the closed-shop
 * placeholder) for the same reason.
 *
 * `getPublicStoreSettings()` is only called once the Stripe keys are present. Not
 * just an optimisation: `isShopOpenFor` itself needs the settings row (it
 * reads `returnsPolicy` and `supportEmail` off it), so there is no way to
 * know whether the shop is open without fetching it once the keys exist —
 * but with no keys at all, `isShopOpenFor` is false regardless of what the
 * row says, so there is nothing to read. And — unlike `src/lib/catalog.ts`
 * — `src/lib/orders.ts` has no "no `DATABASE_URL`, fall back to the in-repo
 * data" path of its own, so calling it unconditionally here would make
 * *every* page in this layout touch a database (migrating and seeding a
 * fresh local one, on a production build with no `DATABASE_URL` — CI, or a
 * preview deploy that hasn't been given one) purely to render props no one
 * reads. Skipping the call keeps that build honest and fast, the same way
 * the shop pages already do for the catalogue itself.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = hasPaymentKeys() ? await getPublicStoreSettings() : null;
  const shopOpen = settings ? isShopOpenFor(settings) : false;
  const pickupEnabled = settings?.pickupEnabled ?? false;
  const shippingNote =
    (shopOpen && settings ? shippingReturnsNote(settings)?.line : null) ?? TERMS_PENDING;

  return (
    <html
      lang="en"
      className={`${bowlby.variable} ${inter.variable} ${jetbrains.variable} ${marker.variable}`}
    >
      <body>
        {/* First focusable element on every page, so a keyboard or
            screen-reader user can jump past the header and tab strip
            instead of tabbing through them before reaching content. */}
        <a href="#main" className="cne-skip-link">
          Skip to content
        </a>
        {/* Set before first paint so scroll-reveal sections start hidden and
            animate in. Without it they would flash visible, then hide. */}
        <script
          dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }}
        />
        <Analytics />
        <JsonLd />
        <RevealRoot />
        {/* The `<symbol>` defs every `Monster`/`MascotDecor` instance
            references via `<use href="#cne-...">` — mounted once here so
            it's present on every page, however many mascots that page draws. */}
        <MascotDefs />
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
        <BagDrawer shopOpen={shopOpen} pickupEnabled={pickupEnabled} shippingNote={shippingNote} />
        <OrderDock />
        {/* Bottom-corner back-to-top monster (idea 15); renders hidden until
            scrolled past ~1.5 screens. */}
        <BackToTop />
        {/* Type S-L-I-D-E on desktop and the page gets pulled into the vortex
            (idea 14). Renders nothing until triggered. */}
        <SlideCode />
        {/* Warms the six header routes once this page has loaded and the
            browser is idle. Renders nothing. */}
        <PrefetchNav />
        {/* Vercel Web Analytics, alongside GA4 (not instead of it). Cookieless;
            loads /_vercel/insights/script.js deferred from our own origin, so
            the CSP already allows it. Nothing is sent from `next dev`. */}
        <VercelAnalytics />
        {/* Vercel Speed Insights — tracks Web Vitals (LCP, CLS, FID/INP, etc.)
            for performance monitoring. Cookieless, loads from our origin. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
