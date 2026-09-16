"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StoreSettings } from "@/lib/settingsAdmin";
import { shippingReturnsNote } from "@/lib/shopCopy";
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
  shipsWithin: string;
  returnsPolicy: string;
  termsText: string;
  /** issue #43: the deliberate, temporary pause — see `shopPaused`'s note on
   * `storeSettings` (`src/db/schema.ts`) for why this is a second flag
   * rather than folded into the pre-launch readout above it on this page. */
  shopPaused: boolean;
  pauseNote: string;
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
    shipsWithin: settings.shipsWithin ?? "",
    returnsPolicy: settings.returnsPolicy ?? "",
    termsText: settings.termsText ?? "",
    shopPaused: settings.shopPaused,
    pauseNote: settings.pauseNote ?? "",
  };
}

function dollarsToCents(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/**
 * The live settings row `shippingReturnsNote` (`@/lib/shopCopy` — the exact
 * helper the storefront calls) would see if the form were saved right now.
 * Starts from the last-saved `settings` and overlays only the fields this
 * form actually edits, so the preview can never drift out of sync with a
 * column this form doesn't touch.
 */
function previewStoreSettings(base: StoreSettings, values: FormValues): StoreSettings {
  return {
    ...base,
    pickupEnabled: values.pickupEnabled,
    pickupAddress: values.pickupAddress,
    shippingFlatCents: dollarsToCents(values.shippingFlatDollars),
    shippingFreeOverCents: values.shippingFreeOverDollars.trim()
      ? dollarsToCents(values.shippingFreeOverDollars)
      : null,
    shipCountries: values.shipCountries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    shipsWithin: values.shipsWithin.trim() || null,
    returnsPolicy: values.returnsPolicy,
  };
}

export function SettingsForm({
  settings,
  shopOpen,
  connections,
  changePassword,
  owners,
}: {
  settings: StoreSettings;
  /** Whether the shop can currently take an order — `isShopOpenFor`
   * (`src/lib/shopStatus.ts`), computed from Stripe keys + a published
   * returns policy + a support email. There's no stored "shop open" flag
   * to flip: `Settings.dc.html`'s big open/closed switch has nothing real
   * behind it here, so this renders the same status as a read-only readout
   * instead — see this phase's report. The "Pause" toggle below (issue #43)
   * is the real switch this readout has no equivalent of: it only exists
   * once the shop is already open, is read straight off `settings` rather
   * than passed in separately, and is orthogonal to this prop entirely. */
  shopOpen: boolean;
  connections: ReactNode;
  changePassword: ReactNode;
  owners: ReactNode;
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
  const shippingPreview = shippingReturnsNote(previewStoreSettings(settings, values));

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
      <div className="rack-page-header" style={{ padding: 0 }}>
        <div>
          <h1 className="rack-page-title rack-bow" style={{ fontSize: 32 }}>
            Settings
          </h1>
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

      <div id="settings-shop" className="rack-settings-shop-card">
        <div>
          <h2 className="rack-bow">The shop is {shopOpen ? "open" : "closed"}.</h2>
          <p>
            {shopOpen
              ? "Stripe is connected, and a returns policy and support email are both set — checkout is live."
              : "Checkout stays closed until Stripe is connected and a returns policy and support email are both set below."}
          </p>
        </div>
        <span className={`adm-pill ${shopOpen ? "is-live" : "is-yellow"}`}>
          {shopOpen ? "Open" : "Closed"}
        </span>
      </div>

      <form id="settings-form" ref={formRef} action={formAction} className="adm-settings-grid">
        {/* issue #43: a deliberate, temporary pause — distinct from the
            pre-launch readout above, which is read-only and about whether
            Stripe/returns/support-email are configured at all. This is a
            real switch the owner flips once the shop is already open, and
            it's part of the same save as everything else on this form. */}
        <div className="adm-settings-section">
          <h2 className="adm-group-label">Pause</h2>

          <label className="adm-toggle-row">
            <span className="adm-toggle">
              <input
                id="shopPaused"
                name="shopPaused"
                type="checkbox"
                checked={values.shopPaused}
                onChange={(event) => setField("shopPaused", event.target.checked)}
                className="adm-toggle-input"
              />
              <span className="adm-toggle-track" aria-hidden="true">
                <span className="adm-toggle-thumb" />
              </span>
            </span>
            Pause the shop
          </label>
          <p className="adm-help">
            Every product page and the shop index stay up and every link still works — only the buy
            button changes, to the note below (or &ldquo;Shop paused&rdquo; if you leave it blank).
            Checkout refuses new orders the whole time this is on.
          </p>

          <div className="adm-field">
            <label htmlFor="pauseNote" className="adm-label">
              Note to customers (optional)
            </label>
            <input
              id="pauseNote"
              name="pauseNote"
              type="text"
              className="adm-input"
              value={values.pauseNote}
              onChange={(event) => setField("pauseNote", event.target.value)}
              placeholder="Back Thursday"
              maxLength={140}
            />
            <FieldError message={fieldErrors.pauseNote} />
          </div>
        </div>

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

        <div id="settings-shipping" className="adm-settings-section">
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
            <label htmlFor="shipsWithin" className="adm-label">
              Ships within (optional)
            </label>
            <input
              id="shipsWithin"
              name="shipsWithin"
              type="text"
              className="adm-input"
              value={values.shipsWithin}
              onChange={(event) => setField("shipsWithin", event.target.value)}
              placeholder="3 business days"
              maxLength={60}
            />
            <p className="adm-help">
              Shown in the shipping line below once set — leave it blank to say nothing about
              timing, same as today.
            </p>
            <FieldError message={fieldErrors.shipsWithin} />
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

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 11,
              marginTop: 18,
              padding: "13px 15px",
              background: "var(--rack-paper)",
              border: "1px dashed var(--rack-rule)",
            }}
          >
            <span className="rack-eyebrow" style={{ flex: "none" }}>
              Reads as
            </span>
            <span className="rack-mono" style={{ fontSize: 12.5 }}>
              {shippingPreview
                ? `"${shippingPreview.line}"`
                : "Add a returns policy below to preview this line — California law requires one before it can show."}
            </span>
          </div>
        </div>

        <div id="settings-connections" className="adm-settings-section">
          {connections}
        </div>

        <div id="settings-policies" className="adm-settings-section is-full">
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

      {/* Change-password and Owners each own their own `<form>` and submit
          independently of the Save bar above, so they render as a second
          grid rather than as fields inside `#settings-form` — nested
          `<form>` elements aren't valid HTML. */}
      <div className="adm-settings-grid adm-settings-account-grid">
        <div id="settings-signin" className="adm-settings-section">
          {changePassword}
        </div>
        <div id="settings-owners" className="adm-settings-section">
          {owners}
        </div>
      </div>

      <div className={`adm-savebar adm-settings-savebar${dirty ? " is-visible" : ""}`}>
        <span className="adm-savebar-count">Unsaved changes</span>
        <button type="button" className="adm-savebar-discard" onClick={discard}>
          Discard
        </button>
        <button
          type="submit"
          form="settings-form"
          className="adm-savebar-save"
          disabled={pending}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          {pending && <span className="rack-spin" aria-hidden="true" />}
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className={`adm-toast${toastMsg ? " is-visible" : ""}`} role="status" aria-live="polite">
        <span>{toastMsg ?? ""}</span>
      </div>
    </>
  );
}
