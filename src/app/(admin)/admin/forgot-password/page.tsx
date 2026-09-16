import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

/** Same check as `requestPasswordResetAction` (`./actions.ts`) — read
 * directly here too so the page never even offers the form when nothing
 * could deliver its email. */
function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export default function ForgotPasswordPage() {
  if (!isEmailConfigured()) {
    return (
      <div className="rack-guest-card">
        <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
        <h1 className="rack-bow rack-guest-title">Forgot password?</h1>
        <p className="adm-notice">
          Emailing isn&rsquo;t set up for this site yet, so no reset link can be sent. Ask whoever
          manages deployment to set RESEND_API_KEY and EMAIL_FROM, or reset a password directly with{" "}
          <code>pnpm owner:password --apply</code>.
        </p>
        <p className="adm-notice">
          <Link href="/admin/sign-in">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return <ForgotPasswordForm />;
}
