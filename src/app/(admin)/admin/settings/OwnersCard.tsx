"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
 * invite or removal — the same pattern the orders desk's `FulfilmentCard`
 * uses — rather than this component tracking its own copy of the list.
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
      router.refresh();
      // Sent-vs-not each get their own way of telling the owner: a toast
      // for "it went out", the persistent notice below (which reads
      // `inviteState` directly) for "here's the link instead".
      if (inviteState.sent) showToast("Invite sent");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteState]);

  const lastRemoveAtRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (removeState?.ok && removeState.at && removeState.at !== lastRemoveAtRef.current) {
      lastRemoveAtRef.current = removeState.at;
      setConfirmEmail(null);
      router.refresh();
      showToast("Owner removed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeState]);

  return (
    <>
      <h2 className="adm-group-label">Owners</h2>

      <ul className="adm-owners-list">
        {owners.map((owner) => (
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
