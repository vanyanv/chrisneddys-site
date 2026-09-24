"use client";

import { useSyncExternalStore } from "react";
import { MAX_PER_ORDER, firstView, productBySlug, type MerchProduct } from "@/data/merch";

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

/** A bag line's own thumbnail — the same `photo.thumbUrl` (or its computed
 * fallback) `ProductShot` renders, so a line keeps its own picture rather
 * than falling back to a shared default. `null` when the product has no
 * photo yet, so the bag row draws `CapArt` instead of a broken `<img>`. */
export type BagLineImage = { url: string; alt: string };

export type BagLine = {
  slug: string;
  qty: number;
  /**
   * A snapshot of the product as it was when this line was added — not a
   * live read. A product that is later edited, unpublished or deleted in
   * /admin must not turn an existing bag line into an empty $0 row, so the
   * bag carries everything a row needs to render with it.
   */
  name: string;
  displayName: [string, string];
  /**
   * Display-only, in cents, from the price at add time. Server-side pricing
   * is authoritative at checkout — `quoteCart` in `src/lib/orders.ts`
   * re-prices every line against the live database — so this number is only
   * ever shown to the buyer while they shop and can drift from what they
   * are actually charged.
   */
  priceCents: number;
  image: BagLineImage | null;
  /** The line's own per-order cap, captured at add time. */
  perOrderLimit: number;
  /** `Date.now()` when the line was first added. Not currently read for
   * anything but useful to have for a future "recently added" sort. */
  addedAt: number;
};

export type BagState = {
  lines: BagLine[];
  /** Drawer visibility lives here so the header button and the drawer agree. */
  open: boolean;
  /** False until `hydrateBag` has read localStorage — see the note below. */
  ready: boolean;
};

/** v2 stores a full display snapshot per line instead of just a slug — see
 * `BagLine`. `hydrateBag` migrates a v1 bag (slug + qty only) into v2 by
 * looking the slug up in the static catalogue, once, the first time it runs. */
const STORAGE_KEY = "cne.bag.v2";
const LEGACY_STORAGE_KEY = "cne.bag.v1";

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

/**
 * The line image the same way `ProductShot` resolves one: the uploaded
 * Blob thumbnail when the first view has one, else the `photoDir`-relative
 * thumbnail path; `null` when the product has no photo at all yet (an
 * unphotographed product can no longer reach here at all once it's
 * published — see `setStatus` in `src/lib/catalogAdmin.ts` — but a draft
 * previewed some other way, or the in-repo fallback copy, still might).
 */
function buildLineImage(product: MerchProduct): BagLineImage | null {
  const view = firstView(product);
  const photo = view?.photo;
  if (!view || !photo) return null;
  const base = `${product.photoDir ?? ""}/${photo.src}`;
  const url = photo.thumbUrl ?? `${base}-thumb.webp`;
  return { url, alt: view.caption };
}

function isBagLineImage(raw: unknown): raw is BagLineImage {
  if (typeof raw !== "object" || raw === null) return false;
  const { url, alt } = raw as Partial<BagLineImage>;
  return typeof url === "string" && url.length > 0 && typeof alt === "string";
}

/**
 * Validates and clamps whatever came out of `localStorage` (or a v1 → v2
 * migration). Unlike the old, catalogue-backed version, this no longer
 * drops a line because its slug isn't in the catalogue — the line carries
 * its own snapshot now, so a product edited or removed since the line was
 * added still renders exactly as it looked when it was added. It only
 * clamps the quantity to the line's own `perOrderLimit`.
 */
export function clean(lines: unknown): BagLine[] {
  if (!Array.isArray(lines)) return [];
  const out: BagLine[] = [];
  for (const raw of lines) {
    if (typeof raw !== "object" || raw === null) continue;
    const line = raw as Partial<BagLine>;

    if (typeof line.slug !== "string" || !line.slug) continue;
    if (typeof line.name !== "string" || !line.name) continue;
    if (
      !Array.isArray(line.displayName) ||
      line.displayName.length !== 2 ||
      typeof line.displayName[0] !== "string" ||
      typeof line.displayName[1] !== "string"
    ) {
      continue;
    }

    const qty = Math.floor(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1) continue;

    const perOrderLimit =
      typeof line.perOrderLimit === "number" &&
      Number.isFinite(line.perOrderLimit) &&
      line.perOrderLimit > 0
        ? Math.floor(line.perOrderLimit)
        : MAX_PER_ORDER;

    const priceCents =
      typeof line.priceCents === "number" && Number.isFinite(line.priceCents)
        ? Math.max(0, Math.floor(line.priceCents))
        : 0;

    const addedAt =
      typeof line.addedAt === "number" && Number.isFinite(line.addedAt) ? line.addedAt : Date.now();

    out.push({
      slug: line.slug,
      qty: Math.min(qty, perOrderLimit),
      name: line.name,
      displayName: [line.displayName[0], line.displayName[1]],
      priceCents,
      image: isBagLineImage(line.image) ? line.image : null,
      perOrderLimit,
      addedAt,
    });
  }
  return out;
}

/**
 * Reads the legacy v1 bag (`{ slug, qty }[]`) and rebuilds each line as a v2
 * snapshot by looking the slug up in the static catalogue — the only
 * catalogue a v1 line could ever have pointed at, since v1 predates the
 * database-backed storefront. A slug no longer in that catalogue is dropped:
 * there is nothing to snapshot, and carrying it forward as an empty line is
 * the exact bug this migration exists to fix. Runs at most once: the v1 key
 * is removed as soon as it's read, migrated or not.
 */
function migrateLegacyBag(): BagLine[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  const out: BagLine[] = [];
  try {
    const legacyLines: unknown = JSON.parse(raw)?.lines;
    if (Array.isArray(legacyLines)) {
      for (const entry of legacyLines) {
        if (typeof entry !== "object" || entry === null) continue;
        const { slug, qty } = entry as { slug?: unknown; qty?: unknown };
        if (typeof slug !== "string") continue;
        const product = productBySlug(slug);
        if (!product) continue;
        const n = Math.floor(Number(qty));
        if (!Number.isFinite(n) || n < 1) continue;
        const limit = product.perOrderLimit ?? MAX_PER_ORDER;
        out.push({
          slug: product.slug,
          qty: Math.min(n, limit),
          name: product.name,
          displayName: product.displayName,
          priceCents: Math.round(product.price * 100),
          image: buildLineImage(product),
          perOrderLimit: limit,
          addedAt: Date.now(),
        });
      }
    }
  } catch {
    // Malformed v1 JSON — nothing to migrate.
  }

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Best effort — losing the old key later is not worth failing over.
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
    lines = raw ? clean(JSON.parse(raw).lines) : migrateLegacyBag();
  } catch {
    lines = [];
  }
  state = { ...state, lines, ready: true };
  emit();
}

/**
 * Re-reads the saved bag, for a page Safari restores from its back-forward
 * cache: its in-memory bag is from before it was left, and the thanks page
 * may have emptied the saved one since (`ClearBagOnce`). Without this, Back
 * from a paid order would offer to check out the paid items again.
 */
export function reloadBag(): BagLine[] {
  let lines: BagLine[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    lines = raw ? clean(JSON.parse(raw).lines) : [];
  } catch {
    lines = [];
  }
  state = { ...state, lines, open: state.open && lines.length > 0, ready: true };
  emit();
  return lines;
}

/**
 * Builds a fresh line's display snapshot from a live product — the pure
 * core of `addToBag`'s "this slug isn't in the bag yet" branch, pulled out
 * so it's directly testable without touching the module's private state or
 * `localStorage`.
 */
export function buildBagLine(product: MerchProduct, qty: number): BagLine {
  const perOrderLimit = product.perOrderLimit ?? MAX_PER_ORDER;
  return {
    slug: product.slug,
    qty: Math.min(perOrderLimit, qty),
    name: product.name,
    displayName: product.displayName,
    priceCents: Math.round(product.price * 100),
    image: buildLineImage(product),
    perOrderLimit,
    addedAt: Date.now(),
  };
}

/**
 * Re-derives an existing line's quantity (and cap) against the *live*
 * product — the pure core of `addToBag`'s "already in the bag" branch. A
 * `perOrderLimit` changed in /admin since the line was first added is
 * picked up on the next add, rather than staying stale until the line is
 * removed and re-added.
 */
export function bumpBagLine(line: BagLine, product: MerchProduct, qty: number): BagLine {
  const fresh = refreshedBagLine(line, product);
  return { ...fresh, qty: Math.min(fresh.perOrderLimit, line.qty + qty) };
}

/**
 * An existing line with its display snapshot (name, price, photo, cap)
 * re-read from the live product, quantity kept but clamped to the cap. A
 * price or photo changed in /admin since the line was added would otherwise
 * sit in the bag unchanged until checkout charged the new one.
 */
export function refreshedBagLine(line: BagLine, product: MerchProduct): BagLine {
  const perOrderLimit = product.perOrderLimit ?? MAX_PER_ORDER;
  return {
    ...line,
    name: product.name,
    displayName: product.displayName,
    priceCents: Math.round(product.price * 100),
    image: buildLineImage(product) ?? line.image,
    perOrderLimit,
    qty: Math.min(perOrderLimit, line.qty),
  };
}

/** Brings the bag's line for `product` (if there is one) up to date with the
 * live product — the product page calls this once the bag has loaded, so a
 * buyer who comes back after a price change sees the price they'll pay. */
export function refreshBagLine(product: MerchProduct) {
  const existing = state.lines.find((l) => l.slug === product.slug);
  if (!existing) return;
  const fresh = refreshedBagLine(existing, product);
  if (JSON.stringify(fresh) === JSON.stringify(existing)) return;
  set({ lines: state.lines.map((l) => (l.slug === product.slug ? fresh : l)) });
}

/** Adds `qty` of `product` to the bag, snapshotting its current display
 * details onto the line — see `buildBagLine` and `bumpBagLine`. */
export function addToBag(product: MerchProduct, qty = 1) {
  const existing = state.lines.find((l) => l.slug === product.slug);
  const lines = existing
    ? state.lines.map((l) => (l.slug === product.slug ? bumpBagLine(l, product, qty) : l))
    : [...state.lines, buildBagLine(product, qty)];
  set({ lines });
}

/** Setting a line to zero removes it — the stepper's minus is also the delete. */
export function setBagQty(slug: string, qty: number) {
  set({
    lines: state.lines.flatMap((l) => {
      if (l.slug !== slug) return [l];
      const n = Math.max(0, Math.min(l.perOrderLimit, Math.floor(qty)));
      return n === 0 ? [] : [{ ...l, qty: n }];
    }),
  });
}

export function removeFromBag(slug: string) {
  set({ lines: state.lines.filter((l) => l.slug !== slug) });
}

/** Empties the bag outright — called once by the thanks page after a
 * successful checkout, since the cart that was just paid for shouldn't
 * still be sitting in it. */
export function clearBag() {
  set({ lines: [] });
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

/** In dollars, from each line's own display-only snapshot price — see the
 * note on `BagLine.priceCents`. Server-side pricing (`quoteCart`) is what
 * actually gets charged. */
export function bagSubtotal(lines: BagLine[]): number {
  return lines.reduce((sum, l) => sum + (l.priceCents / 100) * l.qty, 0);
}
