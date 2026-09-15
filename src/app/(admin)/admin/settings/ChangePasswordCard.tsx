"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";
import { SettingsToast } from "./SettingsToast";

const initial: ChangePasswordState = {};

/** The Owners card's neighbour: current + new password, calling
 * `changePasswordAction` (`@/lib/auth`'s `auth.api.changePassword`, always
 * with `revokeOtherSessions: true`). A wrong current password comes back as
 * a field-level error and changes nothing; a successful change clears the
 * form and signs out every other device, which the toast says plainly. */
export function ChangePasswordCard() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (state?.ok && state.savedAt && state.savedAt !== lastSavedAtRef.current) {
      lastSavedAtRef.current = state.savedAt;
      formRef.current?.reset();
      setToastMsg("Password changed. Every other device was signed out.");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg(null), 5000);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <>
      <h2 className="adm-group-label">Change password</h2>

      <form ref={formRef} action={formAction} className="adm-account-form">
        <div className="adm-field">
          <label htmlFor="currentPassword" className="adm-label">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className="adm-input"
            required
          />
        </div>

        <div className="adm-field">
          <label htmlFor="newPassword" className="adm-label">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            className="adm-input"
            required
          />
          <p className="adm-help">
            At least 12 characters. Signs out every other signed-in device.
          </p>
        </div>

        {state?.error && (
          <p className="adm-field-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </button>
      </form>

      <SettingsToast message={toastMsg} />
    </>
  );
}
