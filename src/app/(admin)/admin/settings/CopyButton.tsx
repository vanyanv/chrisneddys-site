"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Ghost `.adm-btn` that copies `value` to the clipboard and shows a
 * "Copied" `.adm-toast` for a couple seconds. Purely a client-side
 * convenience next to the read-only webhook URL field in `ConnectionsCard`
 * — it has no `name`, so it never touches the settings form's payload. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions
      // denied) — fail silently rather than break the page.
    }
  }, [value]);

  return (
    <>
      <button type="button" className="adm-btn" onClick={() => void copy()}>
        Copy
      </button>
      <div className={`adm-toast${copied ? " is-visible" : ""}`} role="status" aria-live="polite">
        <span>Copied</span>
      </div>
    </>
  );
}
