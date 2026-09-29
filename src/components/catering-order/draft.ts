"use client";

/**
 * The catering order builder's own state: everything C2-C9 collect, kept in
 * one object so it can be persisted to `localStorage` (versioned key, like
 * the merch bag in `bagStore.ts`) and so "back" from any step still shows
 * what was picked.
 *
 * Unlike the merch bag this never needs to be read from outside the builder
 * (no header icon shows a catering order count), so it lives as component
 * state in `OrderBuilder` rather than a module-level store — `useDraft`
 * below is just the localStorage read/write half of that.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CartLine, Fulfilment, TipInput } from "@/lib/catering/types";
import type { CateringStoreId } from "@/lib/catering/stores";
import { lineKey } from "@/lib/catering/pricing";

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  instructions?: string;
};

export type Contact = {
  name: string;
  email: string;
  phone: string;
};

export type OnsiteContact = {
  name: string;
  phone: string;
};

export type OrderDraft = {
  fulfilment: Fulfilment | null;
  store: CateringStoreId | null;
  address: Address | null;
  rangeMiles: number | null;
  date: string | null;
  time: string | null;
  lines: CartLine[];
  tip: TipInput;
  plateSets: number;
  contact: Contact;
  company: string;
  poNumber: string;
  onsite: OnsiteContact | null;
  customerNote: string;
};

export const EMPTY_DRAFT: OrderDraft = {
  fulfilment: null,
  store: null,
  address: null,
  rangeMiles: null,
  date: null,
  time: null,
  lines: [],
  tip: { tipPercent: 10 },
  plateSets: 0,
  contact: { name: "", email: "", phone: "" },
  company: "",
  poNumber: "",
  onsite: null,
  customerNote: "",
};

const DRAFT_KEY = "cne.catering.draft.v1";
/** The one thing a returning customer's browser remembers across orders. */
const CONTACT_KEY = "cne.catering.contact.v1";

function safeParse<T>(raw: string | null): Partial<T> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return null;
  }
}

function loadDraft(): OrderDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const saved = safeParse<OrderDraft>(window.localStorage.getItem(DRAFT_KEY));
    if (!saved) return EMPTY_DRAFT;
    return { ...EMPTY_DRAFT, ...saved };
  } catch {
    return EMPTY_DRAFT;
  }
}

export type ReturningContact = {
  contact: Contact;
  company: string;
  address: Address | null;
};

/** The last order's contact + address, remembered so a returning customer's
 * details step (C2/C8) can prefill instead of starting blank. */
export function loadReturningContact(): ReturningContact | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = safeParse<ReturningContact>(window.localStorage.getItem(CONTACT_KEY));
    if (!saved?.contact?.email) return null;
    return {
      contact: {
        name: saved.contact.name ?? "",
        email: saved.contact.email,
        phone: saved.contact.phone ?? "",
      },
      company: saved.company ?? "",
      address: saved.address ?? null,
    };
  } catch {
    return null;
  }
}

export function saveReturningContact(info: ReturningContact) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACT_KEY, JSON.stringify(info));
  } catch {
    // Private mode / full quota — losing the prefill is not worth breaking the page.
  }
}

/**
 * Loads the draft once on mount (so the server-rendered shell and the
 * client's first paint match — same reason `bagStore` starts `ready: false`)
 * and persists every change after that.
 */
export function useDraft() {
  const [draft, setDraftState] = useState<OrderDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    setDraftState(loadDraft());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Best effort, as above.
    }
  }, [draft, ready]);

  const setDraft = useCallback((patch: Partial<OrderDraft> | ((d: OrderDraft) => OrderDraft)) => {
    setDraftState((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(EMPTY_DRAFT);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // As above.
      }
    }
  }, []);

  return { draft, setDraft, clearDraft, ready };
}

/** Same `CartLine` merge key `lineKey` uses, applied to a draft's own line
 * list: adding a line that matches an existing one bumps its qty instead of
 * appending a duplicate row. */
export function addOrMergeLine(lines: CartLine[], line: CartLine): CartLine[] {
  const k = lineKey(line);
  const idx = lines.findIndex((l) => lineKey(l) === k);
  if (idx === -1) return [...lines, line];
  const next = [...lines];
  const existing = next[idx];
  if (!existing) return next;
  next[idx] = { ...existing, qty: existing.qty + line.qty };
  return next;
}

export function updateLineAt(lines: CartLine[], index: number, line: CartLine): CartLine[] {
  const withoutOld = lines.filter((_, i) => i !== index);
  return addOrMergeLine(withoutOld, line);
}

export function removeLineAt(lines: CartLine[], index: number): CartLine[] {
  return lines.filter((_, i) => i !== index);
}
