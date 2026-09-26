"use client";

import { useSyncExternalStore } from "react";
import { flagship, locations, type Location } from "@/data/locations";
import type { MenuItem } from "@/data/menu";
import { itemOrderUrl, withUtm, type OrderSurface } from "@/lib/otter";

/**
 * Which store a visitor orders from, once they have said (issue #178).
 *
 * With two stores open, an ORDER button that isn't on a store's own page has
 * to ask. It asks once: the first tap opens the "Which location?" panel
 * (`OrderPicker`), the pick is kept in this browser, and every ORDER after
 * that goes straight to that store. The header tag and the phone bar name the
 * remembered store and reopen the panel to switch.
 *
 * Browser storage only, and only a convenience: when it is empty or blocked
 * the visitor is simply asked again. A remembered store that is no longer
 * open (or no longer exists) is ignored.
 */

const KEY = "cne-order-location";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab picking a store updates this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Store ids fall back to memory when storage throws, so a pick still sticks for the visit. */
let memory: string | null = null;

export function rememberOrderChoice(id: string) {
  memory = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Private mode or blocked storage: `memory` carries it for this visit.
  }
  emit();
}

/** The open stores an order can go to. */
export function orderableLocations(): Location[] {
  return locations.filter((loc) => loc.isOpen && loc.orderUrl);
}

/** The remembered store, or the only open one; null when the visitor must choose. */
export function useOrderChoice(): Location | null {
  const id = useSyncExternalStore(
    subscribe,
    () => read() ?? memory,
    () => null,
  );
  const orderable = orderableLocations();
  if (orderable.length === 1) return orderable[0]!;
  return orderable.find((loc) => loc.id === id) ?? null;
}

/** True when there is more than one store to choose between. */
export function hasOrderChoice(): boolean {
  return orderableLocations().length > 1;
}

type Item = Pick<MenuItem, "name" | "otterId">;

/**
 * Where ORDER goes for this store. Hollywood can open the exact item: the
 * item ids in `menu.ts` are its Otter store's. Other stores open their own
 * storefront, where the visitor taps the item; their item ids were not
 * available to check (Otter is not reachable from where this was built).
 */
export function orderTargetUrl(loc: Location, surface: OrderSurface, item?: Item): string {
  if (item && loc.id === flagship.id) return itemOrderUrl(item, surface);
  return withUtm(loc.orderUrl!, surface);
}

/** What the panel was opened for: the surface to credit, and the item if any. */
export type PickerRequest = { surface: OrderSurface; item?: Item & { id: string } };

const pickerListeners = new Set<(req: PickerRequest) => void>();

/** Opens the "Which location?" panel. `OrderPicker` is mounted once in the site layout. */
export function openOrderPicker(req: PickerRequest) {
  for (const fn of pickerListeners) fn(req);
}

export function onOrderPickerRequest(fn: (req: PickerRequest) => void) {
  pickerListeners.add(fn);
  return () => {
    pickerListeners.delete(fn);
  };
}
