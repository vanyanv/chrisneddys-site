# Opening the store

An ordered walkthrough for turning the shop on. Roughly 45 minutes of
dashboard work, most of it waiting for DNS. Nothing here touches code —
`DEPLOY.md` explains how each piece is wired, this file is the order to do
them in and what each one asks of you personally.

Until the last step the live site is unchanged: the bag's checkout button
stays in its "OPENING SOON" state and `POST /api/checkout` returns 503, so
you can do this over several sittings without a half-open store.

## Before you start

Have these to hand. Stripe will ask for all of them in one sitting and time
out if you go looking mid-form.

- **The business's legal name and address** as registered.
- **EIN**, or your SSN if the business is a sole proprietorship.
- **A business bank account** — routing and account number. Stripe pays out
  here; it cannot be changed without re-verification.
- **A California seller's permit** from CDTFA (<https://cdtfa.ca.gov>). Free,
  issued online, usually same-day. Selling physical goods in California
  requires one, and Stripe Tax needs its number for the tax registration in
  step 5.
- **DNS access for chrisneddys.com** — wherever the nameservers point.
- **Vercel** access to the project, with permission to edit environment
  variables.

Only you can do these. An account opened by anyone else fails verification
at the first payout.

## 1. Rotate the Neon password

The connection string was pasted into a chat transcript, so treat it as
public.

Neon console → the project → Roles → `neondb_owner` → **Reset password**.
Copy the new connection string. It looks like
`postgresql://neondb_owner:...@ep-....neon.tech/neondb?sslmode=require`.

## 2. Generate the owner secrets

Run this in a terminal in a clone of this repo. It prints three lines; keep
the output on screen for step 3 and close it afterwards — don't paste it
into chat, email or a note.

```
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "OWNER_EMAILS=chris@chrisneddys.com"
pnpm owner:password 'pick-a-strong-password-here'
```

The third command prints `OWNER_PASSWORD_HASH=scrypt$...`. The password
itself is never stored anywhere — only that hash — so write the password
down somewhere you and the other owners can reach it. Everyone shares this
one password for now; see **Later** at the bottom.

## 3. Vercel: environment variables and the Blob store

Vercel → the project → **Storage** → Create → **Blob**. Name it anything.
Creating it sets `BLOB_READ_WRITE_TOKEN` on the project automatically — this
is where product photos go.

Then **Settings → Environment Variables**, scoped to Production (and Preview
if you want previews reading the real catalogue):

| Variable              | Value                                      |
| --------------------- | ------------------------------------------ |
| `DATABASE_URL`        | the rotated string from step 1             |
| `AUTH_SECRET`         | from step 2                                |
| `OWNER_EMAILS`        | comma-separated, no spaces                 |
| `OWNER_PASSWORD_HASH` | from step 2, the whole `scrypt$...` string |

Redeploy. The build now migrates the database and seeds the Foam Trucker.
Sign in at <https://www.chrisneddys.com/admin> to confirm — the dashboard
lists which connections are still missing.

## 4. Resend, for order emails

<https://resend.com> — free tier covers this volume. Sign up, then
**Domains → Add domain** → `chrisneddys.com`.

Resend shows three DNS records: a DKIM `TXT` at `resend._domainkey`, and an
`MX` plus an SPF `TXT` on a `send.` subdomain. The exact values are
region-specific, so copy them from the dashboard rather than from anywhere
else. Add all three at your DNS host and click Verify. Propagation is
usually minutes, occasionally an hour.

Once verified, **API Keys → Create**, then in Vercel:

| Variable         | Value                                     |
| ---------------- | ----------------------------------------- |
| `RESEND_API_KEY` | the key, shown once                       |
| `EMAIL_FROM`     | `Chris N Eddy's <orders@chrisneddys.com>` |

Skipping this doesn't break anything — order emails get logged instead of
sent, and checkout still works. But the customer gets no confirmation.

## 5. Stripe, in test mode

<https://stripe.com> → sign up with the business details from the top of
this file. **Leave the dashboard toggle in Test mode** for everything below.

1. **Tax.** Dashboard → Tax → Get started. Then Registrations → Add →
   United States → California, using the seller's permit number. This is not
   optional: every Checkout Session this app creates asks Stripe to
   calculate tax, and without a registration Stripe errors out and checkout
   fails outright rather than undercharging.
2. **Webhook.** Developers → Webhooks → Add endpoint:
   `https://www.chrisneddys.com/api/stripe/webhook`, subscribed to exactly
   these five events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
3. **Keys.** Developers → API keys → copy the secret key (`sk_test_...`).
   From the webhook you just made, copy its **Signing secret**
   (`whsec_...`).

In Vercel:

| Variable                | Value                                   |
| ----------------------- | --------------------------------------- |
| `STRIPE_SECRET_KEY`     | `sk_test_...`                           |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the test-mode endpoint |

Redeploy.

## 6. Store settings

Sign in at `/admin` → **Settings**. The shop will not open until the first
two are filled in, by design — a store that takes money without a stated
returns policy is a problem in California, where the policy has to be
visible before purchase (Civil Code §1723).

- **Support email** — where customers reply.
- **Returns policy** — plain English. A 30-day window is the safe default.
- **Terms** — optional, shown at `/terms`.
- **Shipping** — a flat rate, free, or pickup-only.
- **Pickup address**, if you offer pickup.

Confirm the Foam Trucker's price on **Products** while you're in there.

## 7. Test the whole path

With test keys still in place, buy a hat:

- Card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
- Expect: the Stripe page collects tax, `/shop/thanks` shows the order with
  an edition number, a confirmation email arrives, and the order appears in
  `/admin/orders`.
- Stripe → Developers → Webhooks → your endpoint → check the delivery
  succeeded (200). A red delivery here means the order never got marked
  paid.
- Mark it shipped in the orders desk and confirm that email arrives too.

Then refund it in Stripe and confirm `/admin/orders` shows it refunded.

## 8. Go live

Flip the Stripe dashboard to **Live mode** and repeat step 5 — live mode has
its own API key _and its own webhook endpoint with a different signing
secret_. Both live values replace the test ones in Vercel. This is the step
people miss: a live key paired with a test webhook secret means every real
order silently never gets marked paid.

Redeploy. Buy one hat with a real card. Refund yourself.

## Later

Sign-in today is one password shared by all the owners, and there is no
"forgot password" link — resetting means re-running step 2 and updating
`OWNER_PASSWORD_HASH`. Once Resend is verified (step 4), that can be
replaced with magic-link sign-in: an owner enters their allowlisted email
and gets a one-time link. No shared secret, no reset flow, per-owner
accounts.
