"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

export type SignInState = { error?: string; retryAfterSeconds?: number };

/** Only ever redirects inside the admin area — never off-site. */
function safeNextPath(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  if (value.startsWith("/admin") && !value.startsWith("//")) return value;
  return "/admin";
}

export async function signInAction(
  _prevState: SignInState | undefined,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const result = await signIn(email, password);
  if (!result.ok) return { error: result.error, retryAfterSeconds: result.retryAfterSeconds };

  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/admin/sign-in");
}
