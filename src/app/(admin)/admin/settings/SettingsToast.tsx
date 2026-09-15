"use client";

/** `.adm-toast` for the account-management cards (change password, owners).
 * Same shape as the orders desk's `OrderToast` — each card owns its own
 * toast state rather than sharing one through a wrapper, since only one of
 * these forms is ever actionable at a time. */
export function SettingsToast({ message }: { message: string | null }) {
  return (
    <div className={`adm-toast${message ? " is-visible" : ""}`} role="status" aria-live="polite">
      <span>{message ?? ""}</span>
    </div>
  );
}
