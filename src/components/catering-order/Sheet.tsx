"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A bottom sheet on a phone, a right-hand drawer from 901px up (same shape as
 * `src/components/counter/ItemSheet.tsx`, without the drag-to-dismiss gesture,
 * which none of C5-C7/C11's wireframes call for). Traps focus and closes on
 * Escape or the scrim.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus({ preventScroll: true });
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const stops = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !(active instanceof Node) || !sheet.contains(active);
      if (e.shiftKey ? active === first || outside : active === last || outside) {
        e.preventDefault();
        (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`cor-scrim${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`cor-sheet${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // `inert` alone doesn't reliably drop this subtree from every
        // engine's accessibility tree (the pinned older headless Chromium
        // this suite runs against among them), so a closed sheet stays
        // reachable by role/label queries and assistive tech even though
        // it's invisible. `aria-hidden` is the well-supported belt to
        // `inert`'s suspenders: both stay so the exit transition (driven by
        // the `is-open` class) still gets to run.
        aria-hidden={open ? undefined : "true"}
        inert={!open}
      >
        {children}
      </div>
    </>
  );
}
