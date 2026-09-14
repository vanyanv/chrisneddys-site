"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Pointer-based drag reorder for a vertical list — no library, works with
 * touch and mouse via the Pointer Events API.
 *
 * The move/up tracking is done with `window`-level listeners (attached by
 * the effect below while `draggingId` is set), not `setPointerCapture` on
 * the handle element: every reorder mid-drag moves the dragged row's DOM
 * node to a new position in the list (React reconciling the reordered
 * `key`s), and that reparenting drops the handle's pointer capture in
 * Chromium — the subsequent `pointerup` then never reaches it, so the drop
 * (and the server save it triggers) silently never fires. Listening on
 * `window` instead means the drag keeps tracking regardless of where the
 * dragged element ends up. Shared by the sheet's row drag handle and the
 * editor's photo drag handle. */
export function usePointerListReorder<T extends string>(
  ids: T[],
  onDrop: (orderedIds: T[]) => void,
) {
  const [order, setOrder] = useState<T[]>(ids);
  const [draggingId, setDraggingId] = useState<T | null>(null);
  const elementsRef = useRef(new Map<T, HTMLElement>());
  const orderRef = useRef(order);
  orderRef.current = order;
  const idsKey = ids.join("|");
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  useEffect(() => {
    setOrder((prev) => (draggingId ? prev : ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const registerRef = useCallback(
    (id: T) => (el: HTMLElement | null) => {
      if (el) elementsRef.current.set(id, el);
      else elementsRef.current.delete(id);
    },
    [],
  );

  const onPointerDownHandle = useCallback(
    (id: T) => (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      setDraggingId(id);
    },
    [],
  );

  const moveTo = useCallback((draggingId: T, clientY: number) => {
    const current = orderRef.current;
    let targetIndex = current.length - 1;
    for (let i = 0; i < current.length; i++) {
      const id = current[i];
      const el = id === undefined ? undefined : elementsRef.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        targetIndex = i;
        break;
      }
    }
    const fromIndex = current.indexOf(draggingId);
    if (fromIndex === -1 || fromIndex === targetIndex) return;
    const next = current.slice();
    next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, draggingId);
    setOrder(next);
  }, []);

  // The authoritative drag tracking: attached to `window` for the duration
  // of the drag so a reorder mid-drag (which moves the handle's DOM node,
  // see the module comment) can never break it.
  useEffect(() => {
    if (!draggingId) return;
    const id = draggingId;
    function onMove(e: PointerEvent) {
      moveTo(id, e.clientY);
    }
    function onUp() {
      setDraggingId(null);
      onDropRef.current(orderRef.current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggingId, moveTo]);

  // Kept on the handle too so a drag that never leaves it (most real,
  // human-speed drags) tracks the pointer immediately rather than waiting
  // for the window listener's next tick; harmless to run twice for the same
  // event since `moveTo`/drop are idempotent for an unchanged order.
  const onPointerMoveHandle = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!draggingId) return;
      moveTo(draggingId, e.clientY);
    },
    [draggingId, moveTo],
  );

  const onPointerUpHandle = useCallback(() => {
    if (!draggingId) return;
    setDraggingId(null);
    onDrop(orderRef.current);
  }, [draggingId, onDrop]);

  return {
    order,
    draggingId,
    registerRef,
    onPointerDownHandle,
    onPointerMoveHandle,
    onPointerUpHandle,
  };
}
