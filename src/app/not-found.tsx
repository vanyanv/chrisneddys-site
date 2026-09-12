import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  // Next injects `<meta name="robots" content="noindex">` on this route itself.
  // `robots: null` drops the layout's `index, follow` pair rather than adding a
  // second, contradictory tag beside it — which is what declaring `noindex`
  // here again would do.
  robots: null,
  // `canonical: null` drops the root canonical this page would otherwise
  // inherit from the layout — a 404 pointing every missing URL at the home
  // page is an invitation to index it as the home page.
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <section
      style={{
        background: "var(--color-cne-red)",
        color: "var(--color-cne-cream)",
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "80px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="cne-halftone" />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 640 }}>
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
        <p
          style={{ fontFamily: "var(--font-body)", fontSize: 18, opacity: 0.95, marginBottom: 32 }}
        >
          The page you’re looking for has left the building. Here’s where to go instead.
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
          Back home →
        </Link>
      </div>
    </section>
  );
}
