"use client";

import type { Fulfilment } from "@/lib/catering/types";
import type { Address, Contact, OnsiteContact } from "./draft";

export type DetailsErrors = Partial<Record<"name" | "email" | "phone", string>>;

/** C8: contact, company/PO, onsite contact for a delivery, and any note. */
export function StepDetails({
  contact,
  company,
  poNumber,
  onsite,
  customerNote,
  fulfilment,
  address,
  returning,
  onNotReturning,
  errors,
  onChange,
}: {
  contact: Contact;
  company: string;
  poNumber: string;
  onsite: OnsiteContact | null;
  customerNote: string;
  fulfilment: Fulfilment | null;
  address: Address | null;
  returning: boolean;
  /** C8's "Not you?" link — clears the prefill back to a blank form. */
  onNotReturning?: () => void;
  errors: DetailsErrors;
  onChange: (patch: {
    contact?: Partial<Contact>;
    company?: string;
    poNumber?: string;
    onsite?: OnsiteContact | null;
    customerNote?: string;
  }) => void;
}) {
  return (
    <div className="cor-step">
      <h1>Your details</h1>
      {returning && (
        <p className="cor-note is-ok">
          Welcome back{contact.name ? `, ${contact.name.split(" ")[0]}` : ""}. We filled this in
          from your last order.{" "}
          {onNotReturning && (
            <button type="button" className="cor-link-btn" onClick={onNotReturning}>
              Not you?
            </button>
          )}
        </p>
      )}

      <label className="cor-field">
        <span className="cor-label">Your name</span>
        <input
          type="text"
          autoComplete="name"
          value={contact.name}
          placeholder="First and last"
          onChange={(e) => onChange({ contact: { name: e.target.value } })}
        />
        {errors.name && <span className="cor-field-err">{errors.name}</span>}
      </label>

      <label className="cor-field">
        <span className="cor-label">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={contact.email}
          placeholder="you@company.com"
          onChange={(e) => onChange({ contact: { email: e.target.value } })}
        />
        {errors.email && <span className="cor-field-err">{errors.email}</span>}
      </label>

      <label className="cor-field">
        <span className="cor-label">Mobile</span>
        <input
          type="tel"
          autoComplete="tel"
          value={contact.phone}
          placeholder="(818) 555-0142"
          onChange={(e) => onChange({ contact: { phone: e.target.value } })}
        />
        {errors.phone && <span className="cor-field-err">{errors.phone}</span>}
      </label>

      <label className="cor-field">
        <span className="cor-label">
          Company <span className="cor-optional">optional</span>
        </span>
        <input
          type="text"
          value={company}
          onChange={(e) => onChange({ company: e.target.value })}
        />
      </label>

      <label className="cor-field">
        <span className="cor-label">
          PO or reference number <span className="cor-optional">optional</span>
        </span>
        <input
          type="text"
          value={poNumber}
          onChange={(e) => onChange({ poNumber: e.target.value })}
        />
      </label>

      {fulfilment === "delivery" && (
        <>
          <p className="cor-label" style={{ marginTop: 20 }}>
            On the day
          </p>
          <label className="cor-field">
            <span className="cor-label">
              On-site contact <span className="cor-optional">optional</span>
            </span>
            <input
              type="text"
              value={onsite?.name ?? ""}
              placeholder="Name"
              onChange={(e) =>
                onChange({ onsite: { name: e.target.value, phone: onsite?.phone ?? "" } })
              }
            />
          </label>
          <label className="cor-field">
            <span className="cor-label">
              On-site contact phone <span className="cor-optional">optional</span>
            </span>
            <input
              type="tel"
              value={onsite?.phone ?? ""}
              onChange={(e) =>
                onChange({ onsite: { name: onsite?.name ?? "", phone: e.target.value } })
              }
            />
          </label>
          {address?.instructions && (
            <p className="cor-fine">Delivery instructions: {address.instructions}</p>
          )}
        </>
      )}

      <label className="cor-field">
        <span className="cor-label">
          Anything else we should know? <span className="cor-optional">optional</span>
        </span>
        <textarea
          value={customerNote}
          maxLength={500}
          onChange={(e) => onChange({ customerNote: e.target.value })}
        />
      </label>
    </div>
  );
}

export function detailsComplete(contact: Contact): boolean {
  return Boolean(contact.name.trim() && /\S+@\S+\.\S+/.test(contact.email) && contact.phone.trim());
}

export function validateDetails(contact: Contact): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!contact.name.trim()) errors.name = "Enter your name.";
  if (!/\S+@\S+\.\S+/.test(contact.email)) errors.email = "Enter a valid email.";
  if (!contact.phone.trim()) errors.phone = "Enter a phone number.";
  return errors;
}
