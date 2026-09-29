"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the route the moment a pending action finishes without an
 * error — the same pattern `orders/[id]/FulfilmentCard.tsx` uses
 * (`useActionCompletion`) for exactly the same reason: these actions
 * (`actions.ts`) don't call `revalidatePath` themselves any more. They used
 * to, inline, for this page specifically — but that raced the action's own
 * just-finished write against PGlite's single connection (only one query
 * at a time, for the whole server) whenever a concurrent request was also
 * reading the database, which the e2e suite's parallel projects reliably
 * are. That could hang the action's response indefinitely, leaving the
 * button stuck on "Approving…" forever. A client-side `router.refresh()`
 * after the action has already returned is a separate request, not part of
 * the action's own response, so it can queue behind other PGlite work
 * instead of deadlocking it.
 */
export function useRefreshOnSuccess(pending: boolean, error: string | undefined) {
  const router = useRouter();
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending && !error) router.refresh();
    wasPending.current = pending;
  }, [pending, error, router]);
}
