"use client";

/** O4's Print button — hidden in the printed output by `@media print`. */
export function PrintButton() {
  return (
    <button type="button" className="cinv-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
