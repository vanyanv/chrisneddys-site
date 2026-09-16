"use server";

import { redirect } from "next/navigation";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { signIn, signOut } from "@/lib/auth";
import {
  finishPasskeySignIn,
  startPasskeySignIn,
  type StartPasskeySignInResult,
} from "@/lib/passkeys";

export type SignInState = {
  error?: string;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
};

/** Only ever redirects inside the admin area — never off-site. */
function safeNextPath(next: string): string {
  if (next.startsWith("/admin") && !next.startsWith("//")) return next;
  return "/admin";
}

export async function signInAction(
  _prevState: SignInState | undefined,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const result = await signIn(email, password);
  if (!result.ok)
    return {
      error: result.error,
      retryAfterSeconds: result.retryAfterSeconds,
      remainingAttempts: result.remainingAttempts,
    };

  redirect(next);
}

/** Step 1 of a passkey sign-in — called directly from `PasskeySignIn.tsx`
 * (not bound to a `<form>`), same as step 2 below. */
export async function passkeySignInStartAction(): Promise<StartPasskeySignInResult> {
  return startPasskeySignIn();
}

export type PasskeySignInFinishState = { error: string; retryAfterSeconds?: number };

/**
 * Step 2: verifies the browser's WebAuthn assertion and, on success,
 * redirects to `next` exactly like `signInAction` does. A locked-out or
 * rejected attempt returns instead of redirecting, so `PasskeySignIn.tsx`
 * can show the same generic error the password form itself would.
 */
export async function passkeySignInFinishAction(
  response: AuthenticationResponseJSON,
  next: string,
): Promise<PasskeySignInFinishState | undefined> {
  const result = await finishPasskeySignIn(response);
  if (!result.ok) return { error: result.error, retryAfterSeconds: result.retryAfterSeconds };

  redirect(safeNextPath(next));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/sign-in");
}
