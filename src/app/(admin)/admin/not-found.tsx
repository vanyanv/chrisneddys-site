import Link from "next/link";
import "@/styles/admin-rack.css";

/**
 * `/admin`'s own 404 (issue #36 phase 5, "When it breaks") — reached for any
 * unmatched path under `/admin/*`, or by an explicit `notFound()` call from
 * a page whose id doesn't resolve to anything real (an order, a product, a
 * run). `(admin)/admin/layout.tsx`'s `requireOwner()` runs before this can
 * ever render, same as it does for every other route in this segment, so
 * this is only ever reached by an owner who's already signed in — there's
 * no guest version of this page.
 *
 * Drawn in The Rack's own visual language (`rack-*` / `--rack-*`) rather
 * than the storefront's `(site)/not-found.tsx` — no halftone field, no
 * marquee red: this is a work tool finding nothing, not a menu board.
 */
export default function AdminNotFound() {
  return (
    <div className="rack-root">
      <div className="rack-break-shell">
        <div className="rack-break-card">
          <p className="rack-eyebrow rack-break-code">404</p>
          <h1 className="rack-bow rack-break-heading">Not on the rack.</h1>
          <p className="rack-break-body">
            There&rsquo;s nothing here &mdash; the link&rsquo;s stale, or whatever it pointed at
            doesn&rsquo;t exist anymore.
          </p>
          <div className="rack-break-actions">
            <Link href="/admin" className="rack-btn-primary">
              Back to Today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
