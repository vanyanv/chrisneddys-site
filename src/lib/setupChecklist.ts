import "server-only";

/**
 * The single source of truth for the admin "setup checklist" — read by both
 * the dashboard (`src/app/(admin)/admin/page.tsx`) and the settings page's
 * `ConnectionsCard.tsx`, which used to duplicate this list and each other's
 * bugs (Payments ticking on `STRIPE_SECRET_KEY` alone, Email on
 * `RESEND_API_KEY` alone, neither checking the second env var each feature
 * actually needs). Nothing here is a form: every item is read straight from
 * `process.env` at request time, not stored settings.
 */
import { brand } from "@/data/brand";
import { isAuthConfigured } from "@/lib/auth";

export type SetupChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  /** Extra context shown under the label — e.g. which of two required env
   * vars is still missing. Empty when there's nothing more to say. */
  detail: string;
};

/** The URL to paste into Stripe's dashboard (Developers → Webhooks). */
export const webhookUrl = `${brand.siteUrl}/api/stripe/webhook`;

function missingDetail(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Missing ${missing.join(", ")}.`;
}

export function getSetupChecklist(): SetupChecklistItem[] {
  const stripeMissing = [
    !process.env.STRIPE_SECRET_KEY && "STRIPE_SECRET_KEY",
    !process.env.STRIPE_WEBHOOK_SECRET && "STRIPE_WEBHOOK_SECRET",
  ].filter((v): v is string => Boolean(v));

  const emailMissing = [
    !process.env.RESEND_API_KEY && "RESEND_API_KEY",
    !process.env.EMAIL_FROM && "EMAIL_FROM",
  ].filter((v): v is string => Boolean(v));

  const items: SetupChecklistItem[] = [
    {
      key: "database",
      label: "Database connected (DATABASE_URL)",
      ok: Boolean(process.env.DATABASE_URL),
      detail: "",
    },
    {
      key: "owner-sign-in",
      label: "Owner sign-in",
      ok: isAuthConfigured(),
      detail: isAuthConfigured()
        ? ""
        : missingDetail(
            [
              !process.env.AUTH_SECRET && "AUTH_SECRET",
              !process.env.OWNER_EMAILS && "OWNER_EMAILS",
              !process.env.OWNER_PASSWORD_HASH && "OWNER_PASSWORD_HASH",
            ].filter((v): v is string => Boolean(v)),
          ),
    },
    {
      key: "photo-storage",
      label: "Photo storage (BLOB_READ_WRITE_TOKEN)",
      ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      detail: "",
    },
    {
      key: "payments",
      label: "Payments",
      ok: stripeMissing.length === 0,
      detail: missingDetail(stripeMissing),
    },
    {
      key: "email",
      label: "Email",
      ok: emailMissing.length === 0,
      detail: missingDetail(emailMissing),
    },
  ];

  return items;
}
