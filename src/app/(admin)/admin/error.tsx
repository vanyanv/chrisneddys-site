"use client";

import { useEffect } from "react";
import Link from "next/link";
import "@/styles/admin-rack.css";

/**
 * The error boundary for every `/admin/*` route (issue #36 phase 5, "When
 * it breaks") — catches anything a page or a Server Action throws once an
 * owner is already signed in and mid-page. It does not catch a failure in
 * `(admin)/admin/layout.tsx` itself (that's above this boundary) or in the
 * outer `(admin)/layout.tsx` root layout (that's `src/app/global-error.tsx`'s
 * job).
 *
 * Deliberately shows neither `error.message` nor `error.stack`: either can
 * carry query values, file paths, or Stripe/DB detail that has no business
 * on an owner's screen, and Next already forwards the full error to the
 * server log on its own. `error.digest` is the one thing Next hands this
 * boundary that's *meant* to be read back to a person — it's the id that
 * correlates this screen with the matching server-side log line, so it's
 * the only detail shown here. Also logged to the browser console
 * (`console.error`), the same as Next's own default error boundary
 * template — that's the developer's devtools, not the owner's screen.
 */
export default function AdminError({
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
    <div className="rack-root">
      <div className="rack-break-shell">
        <div className="rack-break-card">
          <p className="rack-eyebrow rack-break-code">Something broke</p>
          <h1 className="rack-bow rack-break-heading">That didn&rsquo;t work.</h1>
          <p className="rack-break-body">
            Something went wrong loading this page. It&rsquo;s been logged &mdash; try again, or
            head back to Today.
          </p>
          <div className="rack-break-actions">
            <button type="button" className="rack-btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/admin" className="rack-btn">
              Back to Today
            </Link>
          </div>
          {error.digest && <p className="rack-break-digest rack-mono">REF {error.digest}</p>}
        </div>
      </div>
    </div>
  );
}
