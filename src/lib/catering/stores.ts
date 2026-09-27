/**
 * The stores catering can be ordered from.
 *
 * A subset of `src/data/locations.ts` — catering is Hollywood and Van Nuys
 * only for now. Glendale (or any future store) joins by adding one entry
 * here; nothing in this library or its callers should ever branch on a
 * store id directly, so a third store needs no `if`.
 */

export const CATERING_STORES = [
  { id: "hollywood", name: "Hollywood" },
  { id: "vannuys", name: "Van Nuys" },
] as const;

export type CateringStore = (typeof CATERING_STORES)[number];
export type CateringStoreId = CateringStore["id"];

export function isCateringStoreId(value: string): value is CateringStoreId {
  return CATERING_STORES.some((s) => s.id === value);
}
