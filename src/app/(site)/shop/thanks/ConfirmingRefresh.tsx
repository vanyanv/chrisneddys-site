"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * "Confirming your payment…" asks the server again after a few seconds.
 *
 * With JavaScript on, that is a soft navigation to the next `?try=`: the
 * page re-renders in place and keeps the reader's position, instead of a
 * `<meta http-equiv="refresh">` reloading the whole document and sending a
 * screen reader back to the top every three seconds (WCAG 2.2.1, axe
 * `meta-refresh`). With JavaScript off, the `<noscript>` refresh still does
 * the job — browsers only parse its contents when scripting is disabled.
 */
export function ConfirmingRefresh({ href, seconds }: { href: string; seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace(href, { scroll: false }), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [router, href, seconds]);

  return (
    <noscript>
      <meta httpEquiv="refresh" content={`${seconds};url=${href}`} />
    </noscript>
  );
}
