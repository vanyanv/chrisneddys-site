"use client";

/** `.adm-toast` for the orders detail page's action cards. Each action
 * group (shipping/pickup, refund) owns its own toast state — only one
 * form is ever actionable at a time, so this never shows two at once —
 * rather than plumbing a single toast through a new client wrapper around
 * the whole page. */
export function OrderToast({ message }: { message: string | null }) {
  return (
    <div className={`adm-toast${message ? " is-visible" : ""}`} role="status" aria-live="polite">
      <span>{message ?? ""}</span>
    </div>
  );
}
