"use client";

import { useActionState } from "react";
import { addCrewAction, type AddPersonState } from "../actions";

const initial: AddPersonState = {};

export function AddPersonForm() {
  const [state, action, pending] = useActionState(addCrewAction, initial);
  return (
    <form action={action} className="clo-addform">
      <label htmlFor="clo-newname" className="clo-sr">
        New person&apos;s name
      </label>
      <input
        id="clo-newname"
        name="name"
        className="clo-input"
        placeholder="New person's name"
        autoComplete="off"
        maxLength={40}
        required
        defaultValue={state.name ?? ""}
      />
      <button type="submit" className="clo-btn is-primary" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error ? (
        <p className="adm-field-error clo-addform-err" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
