"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductField } from "@/lib/catalogAdmin";
import type { AuthenticityFact } from "@/db/schema";
import { applyProductChangesAction } from "./actions";

/** Every field the Save bar can batch: the 17-field `ProductField` whitelist
 * plus the pseudo-field the sheet's stock cell and the editor's count/
 * edition-size field write through (`applyProductChanges` maps it onto
 * `setInventory` for whatever mode the product is currently in). */
export type PendingField = ProductField | "inventoryN";

export type PendingChangeValue = string | number | boolean | string[] | AuthenticityFact[] | null;

export type PendingEntry = { id: string; field: PendingField; value: PendingChangeValue };

function keyFor(id: string, field: PendingField): string {
  return `${id}:${field}`;
}

export type ToastTone = "default" | "error";
export type ToastState = { message: string; tone: ToastTone; undo?: () => void } | null;

export type ShowToastOptions = { tone?: ToastTone; undo?: () => void };

/** Owns the sheet-wide pending-change map (one Save bar for every editable
 * cell — the sheet's Price/Stock cells and the expanded row / standalone
 * editor's Copy, Edition &amp; extras and disclosure fields all write into
 * the same map), plus the toast used by every instant control on the page.
 * `onSaved` lets the caller (the sheet) fold the applied changes back into
 * its row list and refresh archived/expanded state. */
export function usePendingChanges(onSaved?: (changes: PendingEntry[]) => void) {
  const [pending, setPending] = useState<Map<string, PendingEntry>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped only by `discardAll` (and a per-field Escape revert calls
   * `clearValue`, not this) — components with an uncontrolled draft (the
   * sheet's click-to-edit cells, the editor's plain inputs) key off this to
   * remount/revert instead of re-deriving from props on every keystroke. */
  const [resetToken, setResetToken] = useState(0);
  /** For the editor footer's "Saved just now" — the ids a successful save
   * last touched, and when. */
  const [lastSaved, setLastSaved] = useState<{ ids: string[]; at: number } | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = useCallback((message: string, opts?: ShowToastOptions) => {
    setToast({ message, tone: opts?.tone ?? "default", undo: opts?.undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const setValue = useCallback((id: string, field: PendingField, value: PendingChangeValue) => {
    const key = keyFor(id, field);
    setPending((prev) => {
      const next = new Map(prev);
      next.set(key, { id, field, value });
      return next;
    });
    setErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearValue = useCallback((id: string, field: PendingField) => {
    const key = keyFor(id, field);
    setPending((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const discardAll = useCallback(() => {
    setPending(new Map());
    setErrors(new Map());
    setResetToken((t) => t + 1);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (pending.size === 0) return true;
    setSaving(true);
    const changes = Array.from(pending.values());
    try {
      const result = await applyProductChangesAction(changes);
      if (result.ok) {
        setPending(new Map());
        setErrors(new Map());
        showToast(`Saved ${result.applied} change${result.applied === 1 ? "" : "s"}`);
        setLastSaved({ ids: Array.from(new Set(changes.map((c) => c.id))), at: Date.now() });
        onSaved?.(changes);
        return true;
      }
      const failed = changes[result.failedIndex];
      if (failed) {
        setErrors((prev) => new Map(prev).set(keyFor(failed.id, failed.field), result.error));
      }
      showToast(result.error, { tone: "error" });
      return false;
    } catch {
      // A dropped connection or a server error used to fail silently here:
      // the bar kept its count and nothing said the save never landed.
      showToast("Couldn't save — check your connection and try again.", { tone: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [pending, showToast, onSaved]);

  useEffect(() => {
    if (pending.size === 0) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pending.size]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const getValue = useCallback(
    (id: string, field: PendingField): PendingChangeValue | undefined =>
      pending.get(keyFor(id, field))?.value,
    [pending],
  );

  const getError = useCallback(
    (id: string, field: PendingField): string | undefined => errors.get(keyFor(id, field)),
    [errors],
  );

  const hasPendingFor = useCallback(
    (id: string) => {
      for (const entry of pending.values()) {
        if (entry.id === id) return true;
      }
      return false;
    },
    [pending],
  );

  return {
    pending,
    pendingCount: pending.size,
    resetToken,
    lastSaved,
    saving,
    setValue,
    clearValue,
    discardAll,
    save,
    getValue,
    getError,
    hasPendingFor,
    toast,
    showToast,
    dismissToast,
  };
}

export type UsePendingChanges = ReturnType<typeof usePendingChanges>;
