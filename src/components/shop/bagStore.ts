"use client";

import { useSyncExternalStore } from "react";
import { MAX_PER_ORDER, productBySlug } from "@/data/merch";

/**
 * The bag.
 *
 * A module-level store rather than a React context, for one reason: the bag has
 * to be readable from the site header — which is rendered by the root layout,
 * above every page — and writable from a product page far below it. Threading a
 * provider through a server layout to join those two would mean making the
 * layout a client boundary and shipping the whole tree's worth of JS with it.
 * A store plus `useSyncExternalStore` keeps the boundary exactly where the
 * interactivity is.
 *
 * The bag survives a reload and a route change but nothing more: it is
 * `localStorage`, on this browser, and it is never sent anywhere. There is no
 * account, and until there is a payment processor there is nothing to send it
 * to. Anyone clearing site data loses a hat they had not bought yet, which is
 * the correct amount of consequence.
 */

export type BagLine = {
  slug: string;
  qty: number;
};

export type BagState = {
  lines: BagLine[];
  /** Drawer visibility lives here so the header button and the drawer agree. */
  open: boolean;
  /** False until `hydrateBag` has read localStorage — see the note below. */
  ready: boolean;
};

const STORAGE_KEY = "cne.bag.v1";

/**
 * The first snapshot must match what the server rendered, or React will paper
 * over a hydration mismatch by throwing the client tree away. So the store
 * starts empty on both sides and only picks up the stored bag in an effect
 * *after* hydration — which is why `ready` exists, and why the header's bag
 * button animates in on a reload rather than being there in the first frame.
 */
const EMPTY: BagState = { lines: [], open: false, ready: false };

let state: BagState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Every mutation replaces the object, because the snapshot is compared by identity. */
function set(next: Partial<BagState>) {
  state = { ...state, ...next };
  emit();
  persist();
}

function persist() {
  if (typeof window === "undefined" || !state.ready) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: state.lines }));
  } catch {
    // Private mode, a full quota, a browser told to block site data. Losing the
    // bag on reload is not worth breaking the page over.
  }
}

/** Drops anything that is no longer a product, or no longer a sane quantity. */
function clean(lines: unknown): BagLine[] {
  if (!Array.isArray(lines)) return [];
  const out: BagLine[] = [];
  for (const raw of lines) {
    if (typeof raw !== "object" || raw === null) continue;
    const { slug, qty } = raw as Partial<BagLine>;
    if (typeof slug !== "string" || !productBySlug(slug)) continue;
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n < 1) continue;
    out.push({ slug, qty: Math.min(n, MAX_PER_ORDER) });
  }
  return out;
}

/**
 * Called once, from an effect, after hydration. Safe to call again — a second
 * call is a no-op, which matters because two mounted components both ask.
 */
export function hydrateBag() {
  if (state.ready) return;
  let lines: BagLine[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) lines = clean(JSON.parse(raw).lines);
  } catch {
    lines = [];
  }
  state = { ...state, lines, ready: true };
  emit();
}

export function addToBag(slug: string, qty = 1) {
  const existing = state.lines.find((l) => l.slug === slug);
  const lines = existing
    ? state.lines.map((l) =>
        l.slug === slug ? { ...l, qty: Math.min(MAX_PER_ORDER, l.qty + qty) } : l,
      )
    : [...state.lines, { slug, qty: Math.min(MAX_PER_ORDER, qty) }];
  set({ lines });
}

/** Setting a line to zero removes it — the stepper's minus is also the delete. */
export function setBagQty(slug: string, qty: number) {
  const n = Math.max(0, Math.min(MAX_PER_ORDER, Math.floor(qty)));
  set({
    lines: n === 0 ? state.lines.filter((l) => l.slug !== slug) : state.lines.map((l) => (l.slug === slug ? { ...l, qty: n } : l)),
  });
}

export function removeFromBag(slug: string) {
  set({ lines: state.lines.filter((l) => l.slug !== slug) });
}

export function openBag() {
  if (state.lines.length === 0) return;
  set({ open: true });
}

export function closeBag() {
  set({ open: false });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => EMPTY;

export function useBag(): BagState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Total items, not total lines — two caps reads 2. */
export function bagCount(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** In dollars. Unknown slugs were already filtered out by `clean`. */
export function bagSubtotal(lines: BagLine[]): number {
  return lines.reduce((sum, l) => sum + (productBySlug(l.slug)?.price ?? 0) * l.qty, 0);
}
