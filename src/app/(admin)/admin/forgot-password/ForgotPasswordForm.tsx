"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.sent) {
    return (
      <div className="adm-signin-card">
        <Image
          src="/cne-logo.webp"
          alt="Chris N Eddy's"
          width={309}
          height={89}
          className="adm-signin-logo"
          priority
        />
        <h1 className="adm-h2">Forgot password</h1>
        <p className="adm-notice">{state.message}</p>
        <p className="adm-notice">
          <Link href="/admin/sign-in">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="adm-signin-card" noValidate>
      <Image
        src="/cne-logo.webp"
        alt="Chris N Eddy's"
        width={309}
        height={89}
        className="adm-signin-logo"
        priority
      />
      <h1 className="adm-h2">Forgot password</h1>
      <p className="adm-notice">
        Enter your email. If it belongs to an owner, we&rsquo;ll send a link to reset the password.
      </p>

      <div className="adm-field">
        <label className="adm-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state.error ? (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="adm-btn adm-btn-primary adm-btn-block" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="adm-notice">
        <Link href="/admin/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
