"use client";

import { useActionState } from "react";
import { createProductAction, type CreateDraftState } from "./actions";

const initialState: CreateDraftState = {};

/** The tiny "name only" form that creates a draft and redirects to its editor. */
export function NewProductForm() {
  const [state, formAction, pending] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="adm-new-product">
      <label htmlFor="new-product-name" className="adm-sr-only">
        New product name
      </label>
      <input
        id="new-product-name"
        name="name"
        type="text"
        placeholder="Product name"
        className="adm-input"
        required
      />
      <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
        {pending ? "Creating…" : "New product"}
      </button>
      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
