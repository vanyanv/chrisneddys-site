"use client";

import { useActionState } from "react";
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

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, initial);
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <>
      <form id="settings-form" action={formAction} className="adm-card adm-product-form">
        <h2 className="adm-h2">Store</h2>

        <div className="adm-field">
          <label htmlFor="storeName" className="adm-label">
            Store name
          </label>
          <input
            id="storeName"
            name="storeName"
            type="text"
            className="adm-input"
            defaultValue={settings.storeName}
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
            defaultValue={settings.supportEmail}
            required
          />
          <p className="adm-help">
            Shown on the returns and terms pages, and to customers looking up an order.
          </p>
          <FieldError message={fieldErrors.supportEmail} />
        </div>

        <h2 className="adm-h2">Pickup</h2>

        <div className="adm-field adm-field-row">
          <input
            id="pickupEnabled"
            name="pickupEnabled"
            type="checkbox"
            defaultChecked={settings.pickupEnabled}
            className="adm-checkbox"
          />
          <label htmlFor="pickupEnabled">Offer pickup at checkout</label>
        </div>

        <div className="adm-field">
          <label htmlFor="pickupAddress" className="adm-label">
            Pickup address
          </label>
          <textarea
            id="pickupAddress"
            name="pickupAddress"
            className="adm-textarea"
            rows={2}
            defaultValue={settings.pickupAddress}
          />
        </div>

        <h2 className="adm-h2">Shipping</h2>

        <div className="adm-grid-2">
          <div className="adm-field">
            <label htmlFor="shippingFlatDollars" className="adm-label">
              Flat rate (USD)
            </label>
            <input
              id="shippingFlatDollars"
              name="shippingFlatDollars"
              type="number"
              step="0.01"
              min="0"
              className="adm-input"
              defaultValue={(settings.shippingFlatCents / 100).toFixed(2)}
              required
            />
            <FieldError message={fieldErrors.shippingFlatDollars} />
          </div>
          <div className="adm-field">
            <label htmlFor="shippingFreeOverDollars" className="adm-label">
              Free over $ (optional)
            </label>
            <input
              id="shippingFreeOverDollars"
              name="shippingFreeOverDollars"
              type="number"
              step="0.01"
              min="0"
              className="adm-input"
              defaultValue={
                settings.shippingFreeOverCents !== null
                  ? (settings.shippingFreeOverCents / 100).toFixed(2)
                  : ""
              }
              placeholder="Leave blank to disable"
            />
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
            defaultValue={settings.shipCountries.join(", ")}
            placeholder="US"
            required
          />
          <p className="adm-help">Default US. Add more as two-letter codes, e.g. US, CA.</p>
          <FieldError message={fieldErrors.shipCountries} />
        </div>

        <h2 className="adm-h2">Returns policy</h2>

        <div className="adm-field">
          <label htmlFor="returnsPolicy" className="adm-label">
            Returns policy
          </label>
          <textarea
            id="returnsPolicy"
            name="returnsPolicy"
            className="adm-textarea"
            rows={8}
            defaultValue={settings.returnsPolicy ?? ""}
          />
          <p className="adm-help">
            Shown at checkout, on the order confirmation and at /returns. California law requires it
            before purchase.
          </p>
        </div>

        <h2 className="adm-h2">Terms of sale</h2>

        <div className="adm-field">
          <label htmlFor="termsText" className="adm-label">
            Terms of sale
          </label>
          <textarea
            id="termsText"
            name="termsText"
            className="adm-textarea"
            rows={8}
            defaultValue={settings.termsText ?? ""}
          />
          <p className="adm-help">Shown at /terms once set.</p>
        </div>

        {state?.error && (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        )}
      </form>

      <div className="adm-editor-footer">
        <button
          type="submit"
          form="settings-form"
          className="adm-btn adm-btn-primary"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>

        {state?.ok && state.savedAt && (
          <span className="adm-saved-note">
            Saved ·{" "}
            {new Date(state.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}

        <a href="/returns/" target="_blank" rel="noreferrer" className="adm-btn">
          View /returns →
        </a>
        <a href="/terms/" target="_blank" rel="noreferrer" className="adm-btn">
          View /terms →
        </a>
      </div>
    </>
  );
}
