"use server";

/**
 * Starts an owner password reset. Delegates to Better Auth's own
 * `requestPasswordReset` (`auth.api.requestPasswordReset({ body: { email,
 * redirectTo } })` — confirmed against `node_modules/better-auth/dist/api/
 * routes/password.d.mts`), which already responds identically whether or
 * not `email` belongs to an account (see that route's handler: an unknown
 * address short-circuits into the exact same `{ status: true, message }` an
 * owner gets, after simulating the same token-generation and lookup work so
 * the timing doesn't give it away either). This action only has to avoid
 * *adding* a distinction Better Auth doesn't already have — so every path
 * through it, including a thrown error, returns the one generic
 * `GENERIC_MESSAGE` — except the one case that's about this site's own
 * configuration, not about any address: Resend not being set up at all.
 */
import { getAuth } from "@/lib/betterAuth";

export type ForgotPasswordState = {
  sent?: boolean;
  message?: string;
  error?: string;
};

const GENERIC_MESSAGE = "If that address belongs to an owner, a reset link is on its way.";

/** True once RESEND_API_KEY and EMAIL_FROM are both set — the same pair
 * `src/lib/setupChecklist.ts` checks for its "Email" checklist item, read
 * directly here (rather than importing that module) so this action stays
 * self-contained. Checked directly against `process.env`, per the task: not
 * inferred from whether `requestPasswordReset` succeeded, since Better
 * Auth's `sendResetPassword` hook fires in the background and never reports
 * its `{ sent, reason }` result back to this call. */
function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter your email address." };

  // This is the one legitimately different response — it's about the
  // site's own configuration, not about whether `email` belongs to an
  // owner, so it doesn't leak anything an attacker could use.
  if (!isEmailConfigured()) {
    return {
      error:
        "Emailing isn't set up for this site yet, so no reset link can be sent. Ask whoever manages deployment to set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  const auth = await getAuth();
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/admin/reset-password" },
    });
  } catch (err) {
    // Better Auth's own handler doesn't throw just because the address is
    // unknown — see the module comment above — so anything landing here is
    // something else (a malformed address, a database hiccup). Swallowed
    // rather than surfaced, so this path still can't be told apart from
    // success.
    console.error("[forgot-password] requestPasswordReset failed", err);
  }

  return { sent: true, message: GENERIC_MESSAGE };
}
