import { isAuthConfigured } from "@/lib/auth";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

function safeNext(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (value && value.startsWith("/admin") && !value.startsWith("//")) return value;
  return "/admin";
}

function wasJustReset(value: string | string[] | undefined): boolean {
  return Boolean(Array.isArray(value) ? value[0] : value);
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    reset?: string | string[];
    expired?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const justReset = wasJustReset(params.reset);
  // Set by `src/middleware.ts` and `requireOwner()` (`src/lib/auth.ts`)
  // whenever this redirect happened because a session that used to exist
  // stopped working, rather than because nobody was ever signed in — see
  // issue #36 phase 5's "signed out" state.
  const sessionExpired = wasJustReset(params.expired);

  if (!isAuthConfigured()) {
    return (
      <div className="rack-guest-card">
        <p className="rack-eyebrow rack-guest-eyebrow">Store room</p>
        <h1 className="rack-bow rack-guest-title">Store admin.</h1>
        <p className="adm-notice">
          Owner sign-in isn&rsquo;t configured yet. Set AUTH_SECRET, OWNER_EMAILS and
          OWNER_PASSWORD_HASH.
        </p>
      </div>
    );
  }

  return <SignInForm next={next} justReset={justReset} sessionExpired={sessionExpired} />;
}
