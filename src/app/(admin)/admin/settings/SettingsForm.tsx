"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StoreSettings } from "@/lib/settingsAdmin";
import { saveSettingsAction, type SaveSettingsState } from "./actions";

const initial: SaveSettingsState = {};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="adm-field-error" role="alert">
      {message}
    </p>
  );
}

/** Every field the form submits, as plain React state. Controlled inputs
 * (rather than `defaultValue` + reading the DOM) so a submit that comes
 * back with field errors doesn't lose what the owner typed: React's
 * `useActionState`/form-action integration resets *uncontrolled* fields to
 * their `defaultValue` once the action settles, success or failure — with
 * these bound to state instead, that reset has nothing to grab and the
 * typed values simply stay on screen next to their error text. */
type FormValues = {
  storeName: string;
  supportEmail: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  shippingFlatDollars: string;
  shippingFreeOverDollars: string;
  shipCountries: string;
  returnsPolicy: string;
  termsText: string;
};

function valuesFromSettings(settings: StoreSettings): FormValues {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    pickupEnabled: settings.pickupEnabled,
    pickupAddress: settings.pickupAddress,
    shippingFlatDollars: (settings.shippingFlatCents / 100).toFixed(2),
    shippingFreeOverDollars:
      settings.shippingFreeOverCents !== null
        ? (settings.shippingFreeOverCents / 100).toFixed(2)
        : "",
    shipCountries: settings.shipCountries.join(", "),
    returnsPolicy: settings.returnsPolicy ?? "",
    termsText: settings.termsText ?? "",
  };
}

export function SettingsForm({
  settings,
  connections,
}: {
  settings: StoreSettings;
  connections: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initial);
  const fieldErrors = state?.fieldErrors ?? {};

  const formRef = useRef<HTMLFormElement>(null);
  // The last-saved (or last-loaded) values — what Discard reverts to and
  // what `dirty` is measured against. A ref, not state: updating it should
  // never itself trigger a render, only the `values` state changes it's
  // compared with do.
  const baselineRef = useRef<FormValues>(valuesFromSettings(settings));
  const [values, setValues] = useState<FormValues>(baselineRef.current);
  const lastSavedAtRef = useRef<string | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);

  const dirty = JSON.stringify(values) !== JSON.stringify(baselineRef.current);

  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // A successful save makes the just-submitted values the new baseline —
  // the bar hides and "Saved <time>" appears — without needing a reload.
  // A failed save leaves the baseline (and `values`) alone, so `dirty`
  // stays true and the bar stays visible, per the field errors below.
  useEffect(() => {
    if (state?.ok && state.savedAt && state.savedAt !== lastSavedAtRef.current) {
      lastSavedAtRef.current = state.savedAt;
      baselineRef.current = values;
      setSavedAt(state.savedAt);
      showToast("Settings saved");
    }
    // Only re-run when the action result changes — `values` is read, not
    // depended on, so typing doesn't re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, showToast]);

  const discard = useCallback(() => {
    setValues(baselineRef.current);
  }, []);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <>
      <div className="adm-settings-header">
        <div className="adm-settings-header-text">
          <h1 className="adm-h1">Settings</h1>
          <p className="adm-settings-lede">
            What customers see at checkout and on the returns and terms pages.
          </p>
        </div>
        {savedAt && !dirty && (
          <span className="adm-saved-note">
            Saved ·{" "}
            {new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}

      <form id="settings-form" ref={formRef} action={formAction} className="adm-settings-grid">
        <div className="adm-settings-section">
          <h2 className="adm-group-label">Store</h2>

          <div className="adm-field">
            <label htmlFor="storeName" className="adm-label">
              Store name
            </label>
            <input
              id="storeName"
              name="storeName"
              type="text"
              className="adm-input"
              value={values.storeName}
              onChange={(event) => setField("storeName", event.target.value)}
              required
            />
            <FieldError message={fieldErrors.storeName} />
          </div>

          <div className="adm-field">
            <label htmlFor="supportEmail" className="adm-label">
              Support email
            </label>
            <input
              id="supportEmail"
              name="supportEmail"
              type="email"
              className="adm-input"
              value={values.supportEmail}
              onChange={(event) => setField("supportEmail", event.target.value)}
              required
            />
            <p className="adm-help">
              Shown on the returns and terms pages, and to customers looking up an order.
            </p>
            <FieldError message={fieldErrors.supportEmail} />
          </div>
        </div>

        <div className="adm-settings-section">
          <h2 className="adm-group-label">Pickup</h2>

          <label className="adm-toggle-row">
            <span className="adm-toggle">
              <input
                id="pickupEnabled"
                name="pickupEnabled"
                type="checkbox"
                checked={values.pickupEnabled}
                onChange={(event) => setField("pickupEnabled", event.target.checked)}
                className="adm-toggle-input"
              />
              <span className="adm-toggle-track" aria-hidden="true">
                <span className="adm-toggle-thumb" />
              </span>
            </span>
            Offer pickup at checkout
          </label>

          <div className="adm-field adm-pickup-address">
            <label htmlFor="pickupAddress" className="adm-label">
              Pickup address
            </label>
            <textarea
              id="pickupAddress"
              name="pickupAddress"
              className="adm-textarea"
              rows={2}
              value={values.pickupAddress}
              onChange={(event) => setField("pickupAddress", event.target.value)}
            />
          </div>
        </div>

        <div className="adm-settings-section">
          <h2 className="adm-group-label">Shipping</h2>

          <div className="adm-grid-2">
            <div className="adm-field">
              <label htmlFor="shippingFlatDollars" className="adm-label">
                Flat rate (USD)
              </label>
              <div className="adm-dollar-field">
                <input
                  id="shippingFlatDollars"
                  name="shippingFlatDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  className="adm-input"
                  value={values.shippingFlatDollars}
                  onChange={(event) => setField("shippingFlatDollars", event.target.value)}
                  required
                />
              </div>
              <FieldError message={fieldErrors.shippingFlatDollars} />
            </div>
            <div className="adm-field">
              <label htmlFor="shippingFreeOverDollars" className="adm-label">
                Free over $ (optional)
              </label>
              <div className="adm-dollar-field">
                <input
                  id="shippingFreeOverDollars"
                  name="shippingFreeOverDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  className="adm-input"
                  value={values.shippingFreeOverDollars}
                  onChange={(event) => setField("shippingFreeOverDollars", event.target.value)}
                  placeholder="Leave blank to disable"
                />
              </div>
              <FieldError message={fieldErrors.shippingFreeOverDollars} />
            </div>
          </div>

          <div className="adm-field">
            <label htmlFor="shipCountries" className="adm-label">
              Ship to (ISO-2 country codes, comma-separated)
            </label>
            <input
              id="shipCountries"
              name="shipCountries"
              type="text"
              className="adm-input"
              value={values.shipCountries}
              onChange={(event) => setField("shipCountries", event.target.value)}
              placeholder="US"
              required
            />
            <p className="adm-help">Default US. Add more as two-letter codes, e.g. US, CA.</p>
            <FieldError message={fieldErrors.shipCountries} />
          </div>
        </div>

        <div className="adm-settings-section">{connections}</div>

        <div className="adm-settings-section is-full">
          <h2 className="adm-group-label">Policies</h2>

          <div className="adm-policies-grid">
            <div className="adm-field">
              <div className="adm-field-label-row">
                <label htmlFor="returnsPolicy" className="adm-label">
                  Returns policy
                </label>
                <a href="/returns/" target="_blank" rel="noreferrer" className="adm-view-link">
                  View /returns ↗
                </a>
              </div>
              <textarea
                id="returnsPolicy"
                name="returnsPolicy"
                className="adm-textarea"
                rows={8}
                value={values.returnsPolicy}
                onChange={(event) => setField("returnsPolicy", event.target.value)}
              />
              <p className="adm-help">
                Shown at checkout, on the order confirmation and at /returns. California law
                requires it before purchase.
              </p>
            </div>

            <div className="adm-field">
              <div className="adm-field-label-row">
                <label htmlFor="termsText" className="adm-label">
                  Terms of sale
                </label>
                <a href="/terms/" target="_blank" rel="noreferrer" className="adm-view-link">
                  View /terms ↗
                </a>
              </div>
              <textarea
                id="termsText"
                name="termsText"
                className="adm-textarea"
                rows={8}
                value={values.termsText}
                onChange={(event) => setField("termsText", event.target.value)}
              />
              <p className="adm-help">Shown at /terms once set.</p>
            </div>
          </div>
        </div>
      </form>

      <div className={`adm-savebar adm-settings-savebar${dirty ? " is-visible" : ""}`}>
        <span className="adm-savebar-count">Unsaved changes</span>
        <button type="button" className="adm-savebar-discard" onClick={discard}>
          Discard
        </button>
        <button type="submit" form="settings-form" className="adm-savebar-save" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className={`adm-toast${toastMsg ? " is-visible" : ""}`} role="status" aria-live="polite">
        <span>{toastMsg ?? ""}</span>
      </div>
    </>
  );
}
