"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/(admin)/admin/actions";

const initialState: SignInState = {};

export function SignInForm({
  next,
  justReset = false,
  sessionExpired = false,
}: {
  next: string;
  justReset?: boolean;
  sessionExpired?: boolean;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

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
      <h1 className="adm-h2">Owner sign-in</h1>
      {justReset ? (
        <p className="adm-notice">Password updated. Sign in with your new password.</p>
      ) : sessionExpired ? (
        <p className="adm-notice">
          You were signed out. Sessions last 12 hours &mdash; sign in again to keep going.
        </p>
      ) : null}
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
          {state.retryAfterSeconds ? "Too many attempts. Try again in a few minutes." : state.error}
        </p>
      ) : null}

      <button type="submit" className="adm-btn adm-btn-primary adm-btn-block" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="adm-notice">
        <Link href="/admin/forgot-password">Forgot password?</Link>
      </p>
    </form>
  );
}
