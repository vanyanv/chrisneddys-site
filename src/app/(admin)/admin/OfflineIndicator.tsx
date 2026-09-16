"use client";

import { useEffect, useState } from "react";
import "@/styles/admin-rack.css";

/**
 * A small, honest "you're offline" indicator for the admin (issue #36
 * phase 5, "When it breaks") — driven entirely by `navigator.onLine` plus
 * the `online`/`offline` window events. This app has no offline queue, so
 * the copy says only what's true: nothing here is being queued or retried,
 * work just won't save until the connection is back.
 *
 * Mounted once, in `(admin)/layout.tsx` (the root layout every `/admin`
 * route shares, signed in or not), rather than in each page's own shell —
 * that's the one place above both the guest shell and every signed-in
 * page's own `rack-topbar`.
 */
export function OfflineIndicator() {
  // Starts `false` — SSR has no `navigator` to read, and guessing "online"
  // is the safe default: it can only ever under-report an already-offline
  // load for one tick before the effect below corrects it, never claim a
  // connection is down when it isn't.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="rack-offline" role="status" aria-live="polite">
      <span className="rack-offline-dot" aria-hidden="true" />
      Offline &mdash; changes here won&rsquo;t save until you&rsquo;re back online.
    </div>
  );
}
