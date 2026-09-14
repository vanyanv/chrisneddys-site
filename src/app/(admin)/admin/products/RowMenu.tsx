"use client";

import Link from "next/link";
import { useRef } from "react";

export type RowMenuAction = {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

/** The "···" menu — native `<details>`/`<summary>`, same pattern as the top
 * bar's owner menu (`admin/layout.tsx`), so it needs no client toggle logic
 * and Enter/Space-opens-it and click-to-open/select come for free. Native
 * `<details>` stops there, though — it doesn't close on Escape and doesn't
 * move focus between items on the arrow keys, both of which the sheet's
 * verification pass requires, so this layers a small `keydown` handler on
 * top rather than replacing the element (keeps the "no client toggle logic"
 * tradeoff the brief accepted for open/close-by-click/outside-click). */
export function RowMenu({ label, actions }: { label: string; actions: RowMenuAction[] }) {
  const ref = useRef<HTMLDetailsElement>(null);

  function close() {
    ref.current?.removeAttribute("open");
  }

  function focusItem(delta: number, from: number) {
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
    if (!items || items.length === 0) return;
    const next = (((from + delta) % items.length) + items.length) % items.length;
    items[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDetailsElement>) {
    if (!ref.current?.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      ref.current.querySelector("summary")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      ref.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
    const current = items.indexOf(document.activeElement as HTMLElement);
    const from = current === -1 ? (e.key === "ArrowDown" ? -1 : 0) : current;
    focusItem(e.key === "ArrowDown" ? 1 : -1, from);
  }

  return (
    <details className="adm-menu-wrap" ref={ref} onKeyDown={onKeyDown}>
      <summary className="adm-menu-btn" aria-label={label}>
        &middot;&middot;&middot;
      </summary>
      <div className="adm-menu" role="menu">
        {actions.map((action) =>
          action.href ? (
            <Link key={action.key} href={action.href} role="menuitem" onClick={close}>
              {action.label}
            </Link>
          ) : (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                close();
                action.onClick?.();
              }}
            >
              {action.label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}
