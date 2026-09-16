"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBlankProductAction } from "./actions";
import type { SetupChecklistItem } from "@/lib/setupChecklist";

/** The four setup items a fresh store actually needs before it can take
 * money, in the order `ProductsEmpty.dc.html` shows them — `getSetupChecklist`
 * (`@/lib/setupChecklist`) also carries `owner-sign-in`, which is skipped
 * here the same way `src/lib/workQueue.ts` skips it for Today's queue:
 * reaching this page at all means the owner already signed in. */
const ORDER = ["database", "payments", "photo-storage", "email"] as const;

function titleOf(item: SetupChecklistItem): string {
  return item.label.replace(/\s*\([^)]*\)\s*$/, "");
}

function metaOf(item: SetupChecklistItem): string {
  if (item.ok) {
    const match = item.label.match(/\(([^)]+)\)/);
    return (match?.[1] ?? "Connected").toUpperCase();
  }
  return (item.detail || "Not configured").toUpperCase();
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="rack-icon"
      style={{ width: 13, height: 13 }}
      viewBox="0 0 16 16"
    >
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  );
}

/**
 * The first-run empty state (`ProductsEmpty.dc.html`) — shown instead of the
 * catalogue grid when there are no products at all yet, live or archived.
 * The checklist is `getSetupChecklist()`'s real read of `process.env`, the
 * same one Today's work queue and Settings' Connections card use — nothing
 * here is invented to match the mockup's specific copy ("NEON · US-WEST-2",
 * "LIVE KEYS · WEBHOOK VERIFIED"): this app has no region or live-vs-test-key
 * lookup to back that, so the honest env-var-backed detail renders instead.
 */
export function RackEmptyState({ checklist }: { checklist: SetupChecklistItem[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const items = ORDER.map((key) => checklist.find((c) => c.key === key)).filter(
    (c): c is SetupChecklistItem => Boolean(c),
  );
  const doneCount = items.filter((c) => c.ok).length;

  async function addFirst() {
    if (creating) return;
    setCreating(true);
    const { id } = await createBlankProductAction();
    router.push(`/admin/products?open=${id}`);
  }

  return (
    <div className="rack-empty-shell">
      <div className="rack-empty-grid">
        <div className="rack-empty-art">
          <svg
            aria-hidden="true"
            style={{
              width: 54,
              height: 54,
              stroke: "currentColor",
              strokeWidth: 1.2,
              fill: "none",
            }}
            viewBox="0 0 48 48"
          >
            <path d="M8 18h32v22H8z" strokeLinejoin="round" />
            <path d="M8 18l4-8h24l4 8M18 26h12" strokeLinejoin="round" />
          </svg>
          <span className="rack-eyebrow">The rack is empty</span>
        </div>

        <div>
          <h1 className="rack-bow rack-empty-heading">
            Put something
            <br />
            on the rack.
          </h1>
          <p className="rack-empty-body">
            A product needs a name, a price and a photo. Everything else — the run size, the copy,
            the shipping line — can wait until it&rsquo;s ready to go live.
          </p>

          <button
            type="button"
            className="rack-btn-primary"
            style={{ padding: "13px 22px", fontSize: 15 }}
            disabled={creating}
            onClick={() => void addFirst()}
          >
            <svg
              aria-hidden="true"
              className="rack-icon"
              style={{ width: 18, height: 18 }}
              viewBox="0 0 16 16"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            {creating ? "Adding…" : "Add your first product"}
          </button>

          <div className="rack-checklist">
            <div className="rack-checklist-head">
              <span className="rack-eyebrow">Before the shop can take money</span>
              <span className="rack-mono" style={{ fontSize: 11, color: "var(--rack-green)" }}>
                {doneCount} OF {items.length} DONE
              </span>
            </div>
            {items.map((item, index) => (
              <div className="rack-checklist-item" key={item.key}>
                <span className={`rack-checklist-num${item.ok ? " is-done" : ""}`}>
                  {item.ok ? <CheckIcon /> : index + 1}
                </span>
                <div className="rack-checklist-body">
                  <div className={`rack-checklist-title${item.ok ? " is-done" : ""}`}>
                    {titleOf(item)}
                  </div>
                  <div className="rack-checklist-meta">{metaOf(item)}</div>
                </div>
                {!item.ok && (
                  <a className="rack-btn" href="/admin/settings">
                    Connect
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
