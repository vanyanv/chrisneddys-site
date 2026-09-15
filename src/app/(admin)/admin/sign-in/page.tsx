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
  searchParams: Promise<{ next?: string | string[]; reset?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const justReset = wasJustReset(params.reset);

  if (!isAuthConfigured()) {
    return (
      <div className="adm-signin-card">
        <h1 className="adm-h2">Store admin</h1>
        <p className="adm-notice">
          Owner sign-in isn&rsquo;t configured yet. Set AUTH_SECRET, OWNER_EMAILS and
          OWNER_PASSWORD_HASH.
        </p>
      </div>
    );
  }

  return <SignInForm next={next} justReset={justReset} />;
}
