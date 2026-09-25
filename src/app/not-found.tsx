import Link from "next/link";
import { bowlby, inter } from "@/lib/fonts";
import "@/styles/globals.css";
import { brand } from "@/data/brand";

/**
 * The true root `not-found.tsx` — the one Next.js falls back to for a URL
 * that matches no route at all. `(site)/not-found.tsx` looks the same but
 * never runs for that case: a route group's `not-found.tsx` only fires for a
 * `notFound()` call thrown inside a page already matched under that group,
 * and an unmatched URL matches no group to begin with. Without this file,
 * every dead link — a typo, an old bookmark, a broken external link — fell
 * through to Next's unstyled default, with no header, no nav and no way back.
 *
 * This file sits outside every route group, so it has no shared root layout
 * to render inside (the site has two, split by group — see
 * `(site)/layout.tsx`'s own comment on why) and declares its own minimal
 * `<html>`/`<body>`. It intentionally does not pull in the full storefront
 * layout (header, footer, analytics, the bag drawer): those assume a page
 * rendered inside a route group's providers, which this one is not.
 */
export default function RootNotFound() {
  return (
    <html lang="en" className={`${bowlby.variable} ${inter.variable}`}>
      <body style={{ margin: 0 }}>
        <section
          style={{
            background: "var(--color-cne-red)",
            color: "var(--color-cne-cream)",
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "80px 24px",
            fontFamily: "var(--font-body)",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 640 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                letterSpacing: 3,
                color: "var(--color-cne-yellow)",
                textTransform: "uppercase",
              }}
            >
              404
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(56px, 10vw, 120px)",
                letterSpacing: 1,
                lineHeight: 0.9,
                textShadow: "5px 5px 0 var(--color-cne-ink)",
                margin: "6px 0 24px",
              }}
            >
              NOT ON THE MENU.
            </h1>
            <p style={{ fontSize: 18, opacity: 0.95, marginBottom: 32 }}>
              The page you&rsquo;re looking for has left the building. Here&rsquo;s where to go
              instead.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-block",
                background: "var(--color-cne-yellow)",
                color: "var(--color-cne-ink)",
                padding: "18px 30px",
                fontFamily: "var(--font-display)",
                fontSize: 18,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                textDecoration: "none",
                border: "3px solid var(--color-cne-ink)",
                boxShadow: "5px 5px 0 var(--color-cne-ink)",
              }}
            >
              Back to {brand.name} →
            </Link>
          </div>
        </section>
      </body>
    </html>
  );
}
