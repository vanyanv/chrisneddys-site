"use client";

import type { ToastState } from "./usePendingChanges";

/** `.adm-toast` — bottom-centre, slides up. `tone: "error"` still uses the
 * ink surface (the CSS has no separate error skin for the toast itself; the
 * failing cell is what turns red via `.adm-cell-edit.is-error`), so the only
 * thing tone changes here is whether an Undo control shows. */
export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  return (
    <div className={`adm-toast${toast ? " is-visible" : ""}`} role="status" aria-live="polite">
      <span>{toast?.message ?? ""}</span>
      {toast?.undo && (
        <button
          type="button"
          className="adm-toast-undo"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
