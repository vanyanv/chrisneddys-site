"use client";

import { useEffect, useRef, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import type { OwnerPasskey } from "@/lib/passkeys";
import {
  finishAddPasskeyAction,
  listPasskeysAction,
  removePasskeyAction,
  startAddPasskeyAction,
} from "./actions";
import { SettingsToast } from "./SettingsToast";

/**
 * Add-a-passkey / list / remove — the Settings-side half of issue #51.
 * `passkeys` is the server-rendered initial list (`page.tsx`, mirroring
 * `OwnersCard`'s own `owners` prop); every change after that re-fetches via
 * `listPasskeysAction` instead of `router.refresh()`, since this card's
 * state (unlike Owners') is entirely private to it — nothing else on the
 * page reads or invalidates on a passkey change.
 */
export function PasskeysCard({ passkeys: initialPasskeys }: { passkeys: OwnerPasskey[] }) {
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [supported, setSupported] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

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

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  async function refresh() {
    setPasskeys(await listPasskeysAction());
  }

  async function handleAdd() {
    setAddError(null);
    setAdding(true);
    try {
      const start = await startAddPasskeyAction(name.trim() || undefined);
      if (!start.ok) {
        setAddError(start.error);
        return;
      }

      let response;
      try {
        response = await startRegistration({ optionsJSON: start.options });
      } catch {
        // Cancelled or timed out in the browser prompt — not a real error.
        return;
      }

      const result = await finishAddPasskeyAction(response, name.trim() || undefined);
      if (!result.ok) {
        setAddError(result.error);
        return;
      }

      setName("");
      showToast("Passkey added");
      await refresh();
    } catch {
      setAddError("Couldn't add that passkey. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoveError(null);
    setRemovingId(id);
    try {
      const result = await removePasskeyAction(id);
      if (!result.ok) {
        setRemoveError(result.error);
        return;
      }
      setConfirmId(null);
      showToast("Passkey removed");
      await refresh();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <h2 className="adm-group-label">Passkeys</h2>
      <p className="adm-help" style={{ marginTop: -6 }}>
        Face ID, Windows Hello or a security key — sign in without typing a password. Your password
        keeps working no matter how many passkeys you add or remove.
      </p>

      {passkeys.length > 0 && (
        <ul className="adm-passkey-list">
          {passkeys.map((pk) => (
            <li key={pk.id} className="adm-passkey-item">
              <span className="adm-passkey-who">
                <span className="adm-passkey-label">{pk.name}</span>
                <span className="adm-conn-detail">
                  Added {new Date(pk.createdAt).toLocaleDateString([], { dateStyle: "medium" })}
                </span>
              </span>

              {confirmId === pk.id ? (
                <span className="adm-passkey-confirm">
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger"
                    onClick={() => handleRemove(pk.id)}
                    disabled={removingId === pk.id}
                  >
                    {removingId === pk.id ? "Removing…" : "Confirm remove"}
                  </button>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => setConfirmId(null)}
                    disabled={removingId === pk.id}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" className="adm-btn" onClick={() => setConfirmId(pk.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {removeError && (
        <p className="adm-field-error" role="alert">
          {removeError}
        </p>
      )}

      {supported ? (
        <div className="adm-account-form adm-passkeys-add">
          <div className="adm-field">
            <label htmlFor="passkeyName" className="adm-label">
              Name this device (optional)
            </label>
            <input
              id="passkeyName"
              type="text"
              className="adm-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Chris's MacBook"
              maxLength={60}
              disabled={adding}
            />
          </div>

          {addError && (
            <p className="adm-field-error" role="alert">
              {addError}
            </p>
          )}

          <button
            type="button"
            className="adm-btn adm-btn-primary"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? "Adding…" : "Add a passkey"}
          </button>
        </div>
      ) : (
        <p className="adm-help">This browser doesn&rsquo;t support passkeys.</p>
      )}

      <SettingsToast message={toastMsg} />
    </>
  );
}
