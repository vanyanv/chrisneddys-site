import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstValue(params.token).trim();

  // No token at all — the reset email's link always carries one, so an
  // owner only lands here without one by following a stale bookmark or a
  // link that got mangled. Same friendly dead end as an expired/used token
  // (`ResetPasswordForm`'s `state.expired` branch), just caught a step
  // earlier since there's nothing to even try submitting.
  if (!token) {
    return (
      <div className="rack-guest-card">
        <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
        <h1 className="rack-bow rack-guest-title">Reset password.</h1>
        <p className="adm-notice">
          This reset link is missing its token, so it can&rsquo;t be used.
        </p>
        <p className="adm-notice">
          <Link href="/admin/forgot-password">Request a new reset link</Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
