"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OwnerRow } from "@/lib/owners";
import {
  inviteOwnerAction,
  removeOwnerAction,
  type InviteOwnerState,
  type RemoveOwnerState,
} from "./actions";
import { SettingsToast } from "./SettingsToast";

const inviteInitial: InviteOwnerState = {};
const removeInitial: RemoveOwnerState = {};

/**
 * Lists current owners (marking which one is you), invites by email, and
 * removes with a confirmation step. `owners` is read server-side
 * (`page.tsx`) and refreshed via `router.refresh()` after a successful
 * invite or removal.
 *
 * The server list is authoritative, but it is not waited on. `router.refresh()`
 * re-renders the whole of `/admin/settings`, and on a database that
 * serializes queries that is unbounded rather than merely slow (#38) — an
 * invite would land, say so, and leave the new owner missing from the list
 * underneath it for as long as the re-render took. Test 6b caught exactly
 * that, timing out after 15s on a row whose account already existed.
 *
 * So an invite or a removal is applied here immediately, over the top of
 * whatever the server last sent, and dropped again as soon as the server's
 * own list agrees. The action returns the real inserted row (`.returning()`
 * in `inviteOwner`), so this shows the same values the re-render will,
 * rather than a guess at them.
 */
export function OwnersCard({ owners }: { owners: OwnerRow[] }) {
  const router = useRouter();

  const [inviteState, inviteFormAction, invitePending] = useActionState(
    inviteOwnerAction,
    inviteInitial,
  );
  const [removeState, removeFormAction, removePending] = useActionState(
    removeOwnerAction,
    removeInitial,
  );

  const inviteFormRef = useRef<HTMLFormElement>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  // Invites and removals the server's `owners` prop hasn't caught up with.
  const [pendingAdds, setPendingAdds] = useState<OwnerRow[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);

  // Whenever a fresh server list arrives, drop anything it now reflects.
  // Keyed on lowercased email because `listOwners` compares that way.
  useEffect(() => {
    const present = new Set(owners.map((owner) => owner.email.toLowerCase()));
    setPendingAdds((prev) => prev.filter((owner) => !present.has(owner.email.toLowerCase())));
    setPendingRemovals((prev) => prev.filter((email) => present.has(email.toLowerCase())));
  }, [owners]);

  const shownOwners = useMemo(() => {
    const byEmail = new Map<string, OwnerRow>();
    for (const owner of owners) byEmail.set(owner.email.toLowerCase(), owner);
    for (const owner of pendingAdds) {
      const key = owner.email.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, owner);
    }
    for (const email of pendingRemovals) byEmail.delete(email.toLowerCase());
    return [...byEmail.values()];
  }, [owners, pendingAdds, pendingRemovals]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 5000);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const lastInviteAtRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (inviteState?.ok && inviteState.at && inviteState.at !== lastInviteAtRef.current) {
      lastInviteAtRef.current = inviteState.at;
      inviteFormRef.current?.reset();
      // Sent-vs-not each get their own way of telling the owner: a toast
      // for "it went out", the persistent notice below (which reads
      // `inviteState` directly) for "here's the link instead".
      //
      // The toast goes up *before* `router.refresh()`, not after (issue
      // #38). `refresh()` re-renders the whole of `/admin/settings` —
      // three DB reads in `page.tsx` plus every card's own — and this
      // confirmation needs none of it: it is reporting what the action
      // already returned. Showing it afterwards makes "your invite went
      // out" wait on work it does not depend on, which on a database that
      // serializes queries is unbounded rather than merely slow.
      if (inviteState.sent) showToast("Invite sent");
      // Show them now; `router.refresh()` only confirms it later.
      if (inviteState.owner) {
        const invited = inviteState.owner;
        setPendingAdds((prev) =>
          prev.some((owner) => owner.email.toLowerCase() === invited.email.toLowerCase())
            ? prev
            : [...prev, invited],
        );
      }
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteState]);

  const lastRemoveAtRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (removeState?.ok && removeState.at && removeState.at !== lastRemoveAtRef.current) {
      lastRemoveAtRef.current = removeState.at;
      setConfirmEmail(null);
      // Toast first, refresh second — see the invite effect above (#38).
      showToast("Owner removed");
      // Drop them now; `router.refresh()` only confirms it later.
      if (removeState.email) {
        const removed = removeState.email;
        setPendingRemovals((prev) =>
          prev.some((email) => email.toLowerCase() === removed.toLowerCase())
            ? prev
            : [...prev, removed],
        );
      }
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeState]);

  return (
    <>
      <h2 className="adm-group-label">Owners</h2>

      <ul className="adm-owners-list">
        {shownOwners.map((owner) => (
          <li key={owner.email} className="adm-owners-item">
            <span className="adm-owners-who">
              <span className="adm-owners-email">
                {owner.email}
                {owner.isYou && <span className="adm-owners-you"> (you)</span>}
              </span>
              {owner.name && <span className="adm-conn-detail">{owner.name}</span>}
            </span>

            {!owner.isYou &&
              (confirmEmail === owner.email ? (
                <form action={removeFormAction} className="adm-owners-confirm">
                  <input type="hidden" name="email" value={owner.email} />
                  <button type="submit" className="adm-btn adm-btn-danger" disabled={removePending}>
                    {removePending ? "Removing…" : "Confirm remove"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setConfirmEmail(null)}
                    disabled={removePending}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="adm-btn"
                  onClick={() => setConfirmEmail(owner.email)}
                >
                  Remove
                </button>
              ))}
          </li>
        ))}
      </ul>

      {removeState?.error && (
        <p className="adm-field-error" role="alert">
          {removeState.error}
        </p>
      )}

      <form
        ref={inviteFormRef}
        action={inviteFormAction}
        className="adm-account-form adm-owners-invite"
      >
        <div className="adm-field">
          <label htmlFor="inviteEmail" className="adm-label">
            Invite an owner
          </label>
          <input
            id="inviteEmail"
            name="email"
            type="email"
            className="adm-input"
            placeholder="owner@example.com"
            required
          />
        </div>

        {inviteState?.error && (
          <p className="adm-field-error" role="alert">
            {inviteState.error}
          </p>
        )}

        <button type="submit" className="adm-btn adm-btn-primary" disabled={invitePending}>
          {invitePending ? "Inviting…" : "Send invite"}
        </button>
      </form>

      {inviteState?.ok && inviteState.sent === false && (
        <p className="adm-notice adm-owners-notice" role="status">
          Couldn&rsquo;t email that invite ({inviteState.reason}). Share this link with them
          instead:
          <br />
          <span className="adm-mono-value">{inviteState.url}</span>
        </p>
      )}

      <SettingsToast message={toastMsg} />
    </>
  );
}
