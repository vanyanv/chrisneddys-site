"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/(admin)/admin/actions";

const initialState: SignInState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="adm-signin-card" noValidate>
      <h1 className="adm-h2">Owner sign-in</h1>
      <input type="hidden" name="next" value={next} />

      <div className="adm-field">
        <label className="adm-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="adm-field">
        <label className="adm-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="adm-btn adm-btn-primary adm-btn-block" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
