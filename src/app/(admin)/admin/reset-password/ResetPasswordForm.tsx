"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

const LOGO = (
  <Image
    src="/cne-logo.webp"
    alt="Chris N Eddy's"
    width={309}
    height={89}
    className="adm-signin-logo"
    priority
  />
);

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.expired) {
    return (
      <div className="adm-signin-card">
        {LOGO}
        <h1 className="adm-h2">Reset password</h1>
        <p className="adm-notice">{state.error}</p>
        <p className="adm-notice">
          <Link href="/admin/forgot-password">Request a new reset link</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="adm-signin-card" noValidate>
      {LOGO}
      <h1 className="adm-h2">Reset password</h1>
      <input type="hidden" name="token" value={token} />

      <div className="adm-field">
        <label className="adm-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>

      <div className="adm-field">
        <label className="adm-label" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </div>

      {state.error ? (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="adm-btn adm-btn-primary adm-btn-block" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
