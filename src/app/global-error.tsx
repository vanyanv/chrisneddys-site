"use client";

import { useEffect } from "react";

/**
 * The fallback for when a root layout itself throws (issue #36 phase 5,
 * "When it breaks"). `(site)/layout.tsx` and `(admin)/layout.tsx` are each
 * their own root layout — two parallel root layouts split by route group,
 * the pattern that file's own comment documents — and this is the one
 * layout above *both* of them: the only place in the app that can still
 * render if either of those fails. Next requires it to render its own
 * `<html>`/`<body>` for exactly that reason — the thing that broke is what
 * would otherwise have provided them.
 *
 * Deliberately independent of every other stylesheet, font and component in
 * this app: no `@/styles/*` import, no `next/font`, no `next/link`, no
 * design-system class names. If whatever failed originated in one of those,
 * reusing it here would only fail the same way twice. Colors below are
 * DESIGN.md's palette as literal hex, not `--rack-*`/`--a-*`/`--color-cne-*`
 * custom properties — those are set by the stylesheets this avoids.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff8e7",
          color: "#1a1612",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#7a6f5e",
              margin: "0 0 8px",
            }}
          >
            Something broke
          </p>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, margin: "0 0 12px" }}>
            The site hit a snag.
          </h1>
          <p style={{ color: "#7a6f5e", margin: "0 0 24px", lineHeight: 1.5 }}>
            Something went wrong loading the page itself. Try again, or start over.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#f5b82e",
                color: "#1a1612",
                border: "1px solid #1a1612",
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain anchor is deliberate here, not `next/link`: this file
                only ever renders when a root layout has already failed, so a
                full page navigation is the one kind of "go home" this can
                trust to work. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                background: "#fff2c9",
                color: "#1a1612",
                border: "1px solid #1a1612",
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Start over
            </a>
          </div>
          {error.digest && (
            <p style={{ margin: "24px 0 0", fontSize: 11, color: "#7a6f5e" }}>REF {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
