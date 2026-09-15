"use server";

/**
 * Completes an owner password reset. Delegates to Better Auth's
 * `resetPassword` (`auth.api.resetPassword({ body: { token, newPassword } })`
 * — confirmed against `node_modules/better-auth/dist/api/routes/
 * password.d.mts`; `token` may also travel as a query param there, but the
 * body is simpler from a server action with no request object). A missing,
 * expired, or already-used token — single-use by
 * `consumeVerificationValue`, so a second submit of the same link hits this
 * same path — surfaces as a thrown `APIError` with `body.code ===
 * "INVALID_TOKEN"`; that's translated into a plain message and `expired:
 * true` rather than ever reaching the caller as a stack trace.
 */
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/betterAuth";

export type ResetPasswordState = {
  error?: string;
  /** Set once the token itself is the problem (missing, expired, already
   * used) — `ResetPasswordForm` swaps to a "request a new link" view
   * instead of leaving the password fields up for another try that can
   * only fail the same way. */
  expired?: boolean;
};

/** Matches `scripts/owner-password.mjs`'s `MIN_PASSWORD_LENGTH`. */
const MIN_PASSWORD_LENGTH = 12;

function apiErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("body" in err)) return undefined;
  const body = (err as { body?: unknown }).body;
  if (!body || typeof body !== "object" || !("code" in body)) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return {
      expired: true,
      error: "This reset link is missing its token, so it can't be used.",
    };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const auth = await getAuth();
  try {
    await auth.api.resetPassword({ body: { token, newPassword: password } });
  } catch (err) {
    const code = apiErrorCode(err);
    if (code === "INVALID_TOKEN" || code === "USER_NOT_FOUND") {
      return {
        expired: true,
        error: "This reset link has expired or already been used.",
      };
    }
    console.error("[reset-password] resetPassword failed", err);
    return { error: "Something went wrong. Try again." };
  }

  // Outside the try/catch: `redirect()` throws a NEXT_REDIRECT-tagged error
  // by design, which the catch above would otherwise swallow as a failure.
  redirect("/admin/sign-in?reset=1");
}
