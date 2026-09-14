"use client";

export function PrintButton() {
  return (
    <button type="button" className="adm-btn adm-btn-primary" onClick={() => window.print()}>
      Print
    </button>
  );
}
