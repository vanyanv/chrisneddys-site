/**
 * Whether this order id has already claimed its `purchase` event, and
 * marks it claimed if not — the pure core of `PurchaseOnce.tsx`'s guard,
 * pulled out so the dedup logic is testable against a plain object instead
 * of a real `sessionStorage` (or a DOM). The component wraps the call in
 * try/catch: some privacy modes throw on any storage access at all.
 */
const KEY_PREFIX = "cne.purchase.sent.";

/** Storage-shaped enough for this — real `sessionStorage`, or a fake in tests. */
type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/**
 * Returns `true` the first time a given order id is claimed, and `false`
 * every time after — a refresh of the thanks page, a duplicate mount, or a
 * second tab on the same order.
 */
export function claimPurchase(storage: KeyValueStore, orderId: string): boolean {
  const key = KEY_PREFIX + orderId;
  if (storage.getItem(key)) return false;
  storage.setItem(key, "1");
  return true;
}
