# Deploying chrisneddys.com

The site is a Next.js app with a server: storefront pages are prerendered and
revalidated, while `/admin/*` and `/api/*` run per request. Headers and the cache
policy ship from `headers()` in `next.config.mjs`, so they apply on any host; the
one thing that is still host configuration is the apex → www redirect, which a
Next.js app cannot do for itself before its own router sees the request.

**Opening the store for the first time is a separate document — see
[`GO-LIVE.md`](GO-LIVE.md)**, which orders the Neon, Vercel, Resend and Stripe
setup and says what each account asks of you. This file explains how the pieces
are wired.

Two things have to be right on day one, because both are expensive to correct
later:

1. **One canonical host.** If both `chrisneddys.com` and `www.chrisneddys.com`
   answer with 200, the entire site exists twice. Link equity splits across the
   pair, and so does analytics. The canonical tags in the HTML all point at
   `https://www.chrisneddys.com`, so **www is the canonical host** — the apex
   must 301 to it, not the other way round.
2. **Correct cache headers.** Everything under `/_next/static/` is
   content-hashed and safe to cache forever. HTML must not be, or a price change
   takes a week to reach anyone.

---

## Cache policy

| Path                                         | Header                                | Why                                                                                                     |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/_next/static/*`                            | `public, max-age=31536000, immutable` | Filenames contain a content hash. A new build produces new names, so these can never go stale.          |
| `/*.webp`, `/*.jpg`, `/*.png`, `/*.svg`      | `public, max-age=604800`              | Photography and the generated map base change rarely, but the filenames are not hashed, so not forever. |
| `*.html`, `/`, `/sitemap.xml`, `/robots.txt` | `public, max-age=0, must-revalidate`  | The menu and its prices live here. A stale price is a support call.                                     |

---

## Security headers

A static export cannot set a header on itself, so every one of these is host
configuration — and none of them exists until someone adds it. The set below is
the whole policy; the three host sections that follow each say where to paste it.

| Header                      | Value                                                                              | Why                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                                     | The apex 301 is a redirect a network can strip. This is what makes the _second_ visit unstrippable.                                                                                      |
| `X-Content-Type-Options`    | `nosniff`                                                                          | `out/` is served straight from a bucket. Without this a file whose `Content-Type` S3 guessed wrong can be re-guessed by the browser into something executable.                           |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                  | Every order button leaves for Otter with the full path in the referrer otherwise. The UTM tags already say where the click came from; the path does not need repeating to a third party. |
| `X-Frame-Options`           | `DENY`                                                                             | Redundant with `frame-ancestors` below, kept for the browsers that never learned the CSP directive.                                                                                      |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()` | The site asks for none of these. Saying so means a script that someday does gets denied rather than prompting.                                                                           |
| `Content-Security-Policy`   | see below                                                                          | The origin allow-list.                                                                                                                                                                   |

### The CSP, and the one concession in it

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com;
font-src 'self';
connect-src 'self' https://api.web3forms.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com;
upgrade-insecure-requests
```

Written as one line, no newlines, in whichever config the host reads.

Every origin in it was read off a built `out/`, not assumed:

- **`script-src`** — `googletagmanager.com` is gtag.js, appended by the snippet in
  `Analytics.tsx`. It is the only third-party script origin the site needs.
- **`connect-src`** — `api.web3forms.com` is where both forms POST. The
  `google-analytics.com` wildcards cover GA4's regional collection endpoints
  (`region1.`, `region2.`, …), which are not optional and are not on the bare
  hostname.
- **`font-src 'self'`** — `next/font` downloads Google's fonts at build time and
  serves them from `/_next/static/media/`. There are 14 `.woff2` files in `out/`
  and no request to `fonts.gstatic.com`, so the font origins are deliberately
  absent. If a face is ever loaded by URL instead, this line is what breaks.
- **`img-src data:`** — the inlined SVG markers.

`script-src` carries **`'unsafe-inline'`**, which is worth being honest about: it
is the directive that would otherwise stop an injected `<script>`, and with it
the CSP's script rule is an origin allow-list rather than an XSS defence. The
alternatives were both checked and neither survives this architecture. A nonce
has to be minted per response, and there is no server to mint one. Hashes are
possible in principle, but `out/index.html` carries **31 inline `<script>`
blocks**, 25 of them Next's own RSC payload (`self.__next_f.push(...)`), whose
contents differ per page and change on every build — so the hash list would have
to be regenerated and re-pasted into host config on each deploy, and would fail
closed, sitewide, the first time someone forgot.

What the directive still buys, and the reason to ship it: an injected script
cannot _load_ from an origin that is not listed, `connect-src` means exfiltration
has nowhere to POST to, `object-src 'none'` and `base-uri 'self'` close two
injection routes outright, and `frame-ancestors 'none'` makes the site
un-iframeable. The real mitigation for inline XSS on this site is upstream and
already holds — see the audit note in `JsonLd.tsx`: nothing user-supplied reaches
an HTML sink, because there is no user-supplied anything. The site renders only
data committed to this repo.

### Roll it out in report-only first

A CSP mistake does not degrade, it blanks the page — and on a static site the
blank is cached. So ship it once as `Content-Security-Policy-Report-Only` with
the same value, walk the site (home, menu, an item sheet, contact, the shop bag,
locations), and confirm the console logs nothing. Then rename the header and
invalidate. The other five headers can go straight in; none of them can break a
page that was not already broken.

### Verify

```sh
curl -sI https://www.chrisneddys.com/ | grep -iE \
  'strict-transport|content-security|x-content-type|referrer-policy|x-frame|permissions-policy'
```

All six should come back. They must be on the **HTML** responses, not only on
`/_next/static/*` — a policy attached to one cache behaviour does not apply to
the other.

---

## Database

The shop's catalogue lives in Postgres (Neon), read through `src/lib/catalog.ts`.
Set `DATABASE_URL` (the Neon connection string) as an environment variable on the
Vercel project — Production, and any Preview that should read and write the real
catalogue.

`pnpm build`'s `prebuild` step (`scripts/db-prepare.mjs`) runs on every build: with
`DATABASE_URL` set it applies any pending migrations in `drizzle/` and upserts the
seed catalogue (`src/db/seed.ts`), both idempotent, so this is safe on every
deploy. A Preview deploy with no `DATABASE_URL` configured — or a `pnpm build` run
anywhere else without one, CI included — prints a message and skips both, and the
site falls back to the in-repo catalogue in `src/data/merch.ts` instead of failing
the build.

With `DATABASE_URL` unset outside of Vitest (`pnpm dev`, or the e2e suite),
`src/db/client.ts` instead opens a file-persisted PGlite database at
`.pglite/dev`, overridable via `PGLITE_DATA_DIR` (relative to the repo root) —
the e2e suite points it at `.pglite/e2e` so it never touches your own dev
database. `hasDatabase()` (`src/db/client.ts`) treats a set `PGLITE_DATA_DIR`
the same as `DATABASE_URL` regardless of `NODE_ENV`, so the e2e suite's
`next start -p ... ` with `NODE_ENV=production` and no `DATABASE_URL` still
reads and writes that PGlite database instead of falling back to
`src/data/merch.ts`, which is how it proves admin writes reach `/shop/`.

---

## Payments

The shop is "open" — the bag's CHECKOUT button live, `POST /api/checkout`
answering instead of 503ing — only once both `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET` are set (`src/lib/shopStatus.ts`). Order confirmation
/ shipping / pickup-ready email additionally needs `RESEND_API_KEY` and
`EMAIL_FROM`; without them an order email is logged instead of sent, and
never fails the checkout or webhook it's attached to. All four are listed
under **Environment variables** below.

**Test mode first.** Use Stripe's test-mode keys end to end — a real Checkout
Session, a real webhook delivery, a real (test) card — before ever setting
live keys in Production. Use a restricted key (`rk_...`), not the full
secret key, for `STRIPE_SECRET_KEY` in both modes: this app only calls
`checkout.sessions.create` (write on Checkout Sessions) and verifies webhook
signatures locally (no permission needed), and Stripe Tax calculation
happens inside that same session-create call — so write on Checkout
Sessions plus read on Tax, and nothing else, covers everything it does.
Store it on Vercel as a sensitive environment variable.

**Stripe Tax must be turned on — and registered, not just enabled.** Every
Checkout Session this app creates sets `automatic_tax: { enabled: true }`,
with an explicit product tax code (`txcd_30011000`, Clothing & Footwear) and
shipping tax code (`txcd_92010001`, Shipping) at `tax_behavior: "exclusive"`,
so the tax treatment no longer depends on the account's preset defaults.

Activation comes first, and it is not the same as enabling it in code. Stripe
Tax stays inert until a head office address is set under Dashboard → Tax →
Settings; until then the Tax Settings status reads `pending`, no tax is
calculated, and the Tax Calculation API rejects a request outright with
"Stripe Tax isn't active for this account". Verified against the sandbox on
2026-09-14: status `pending`, no head office, no preset product tax code, no
default tax behaviour and zero registrations.

Once it is active the failure mode inverts and gets much quieter. Stripe Tax
does not error when a jurisdiction has no active registration —
it silently calculates and collects zero tax, the session still succeeds,
and checkout looks completely normal. This is the single most common Stripe
Tax mistake. Before the first real transaction, every jurisdiction this
store owes tax in must show **Collecting** under Dashboard → Tax →
Locations: adding a registration in Stripe only records that you're already
registered with that tax authority, it does not register you with them. A
registration created in the sandbox does not carry over to live mode and
must be re-created there. Nexus threshold monitoring only counts live-mode
transactions too, so test-mode volume gives no signal — the clock starts at
the first live sale. Whether this store is obliged to register anywhere is
a question for a tax advisor, not something this document decides.

**Invoices are on, but customer emails are opt-in.** Every Checkout Session
this app creates sets `invoice_creation: { enabled: true }`, so Stripe
generates an invoice for each order rather than only for subscriptions.
Whether the customer actually receives that invoice by email depends on a
Dashboard setting, not this code: "Successful payments" must be ticked under
"Email customers about" in the Stripe Dashboard's customer emails settings.
That setting lives per environment, so ticking it in the sandbox does
nothing for live mode — it has to be turned on again there.

**Webhook endpoint.** In the Stripe dashboard → Developers → Webhooks, add
an endpoint at:

```
https://www.chrisneddys.com/api/stripe/webhook
```

subscribed to exactly these four event types:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`
- `charge.refunded`

(Stripe's UI lists these as a flat set to check, not five separate
endpoints — one endpoint, five event types.) Copy the endpoint's "Signing
secret" into `STRIPE_WEBHOOK_SECRET`. The route verifies every delivery
against this secret and 400s a bad signature; it never trusts an
unauthenticated POST to mark an order paid.

**Idempotency.** Every webhook delivery's Stripe event id is recorded before
it's processed and checked again before anything happens, so a duplicate
delivery — Stripe retries a slow or failed response — never double-marks an
order paid or double-assigns an edition number. If the handler itself throws
partway through, the id's claim is rolled back before the 500 goes out, so
Stripe's automatic retry gets a real attempt rather than being silently
skipped as "already seen."

---

## Owner accounts

`/admin` sign-in is per-owner accounts on Better Auth, not a shared password.
Each owner has their own email and password, stored in the database (`user`
and `account` tables) rather than in an environment variable.

**First sign-in seeds the first account.** With no rows in the `user` table
yet, signing in with an email from `OWNER_EMAILS` and the password matching
`OWNER_PASSWORD_HASH` creates that owner's account with that password. After
that first sign-in, both env vars are ignored — the database is the source of
truth, and changing them does nothing until `user` is empty again.
`AUTH_SECRET` is unrelated to that seeding step and is still required always:
Better Auth signs sessions with it.

**Inviting an owner.** From `/admin/settings`, an existing owner invites a new
one by email; the invitee gets a link to set their own password. There is no
env var to edit and nothing to redeploy. That link is always a full URL, not
a path — it has to work from inside an email client, which has no page to
resolve a relative link against. It points at `SITE_ORIGIN` if set, or
otherwise at this site's own canonical domain — `SITE_ORIGIN` only matters
when the site is being served somewhere other than that canonical domain,
such as a Vercel preview that needs its emailed link to point back at
itself.

**Removing an owner.** Also from Settings — removing an owner revokes their
sessions immediately. You can't remove the last owner or yourself.

**Sessions** last 12 hours and are stored server-side, so they can be revoked
rather than only outliving a cleared cookie. Changing your password (from
Settings, or via a reset link) signs out every other device — a stolen laptop
or an old, still-logged-in browser stops working the moment the password
changes.

**Forgot password** sends a one-hour, single-use reset link, which needs
`RESEND_API_KEY` and `EMAIL_FROM` configured (see **Environment variables**
below). Without them, the sign-in page says emailing isn't set up rather than
pretending a link went out.

**Break-glass: locked out with no working sign-in.** If the reset email can't
reach you either, set the owner's password directly from a machine that can
reach the database:

```
DATABASE_URL='...' pnpm owner:password --apply owner@example.com 'a-new-password'
```

This connects to the database named in `DATABASE_URL` and overwrites that
owner's stored password — no redeploy, no email. It refuses if `DATABASE_URL`
is unset, if no `user` row matches that email (invite them first), or if the
password is under 12 characters. Run it with the **production** `DATABASE_URL`
if that's the account you're locked out of — pointing it at your local
database only fixes sign-in there.

To print a hash for the _first-sign-in seeding_ path above instead of writing
to the database, run the same script without `--apply`:

```
pnpm owner:password 'a-new-password'
```

This only prints — see the `$`-escaping gotcha below before pasting the
result into a `.env` file.

---

## Environment variables

Set these on the Vercel project (Production, and any Preview that should read
and write real data). Locally they go in `.env.local`, which is gitignored.

| Variable                | Needed for                                                                                                                                                                                                                                                                              | Unset means                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | The catalogue, orders and editions — the Neon connection string. Check the **database name** at the end of it: one Neon endpoint can host several.                                                                                                                                      | `pnpm dev` uses a file-persisted PGlite database at `.pglite/dev`; a production build falls back to the in-repo catalogue in `src/data/merch.ts`   |
| `AUTH_SECRET`           | Signing `/admin` owner sessions — Better Auth signs with it. Generate with `openssl rand -base64 32`                                                                                                                                                                                    | No owner can sign in                                                                                                                               |
| `OWNER_EMAILS`          | Comma-separated allowlist that seeds the _first_ owner account(s) on first sign-in — see **Owner accounts** above. Ignored once the `user` table has rows                                                                                                                               | Nothing to seed — with no owner accounts yet, nobody can sign in. Once accounts exist, unset has no effect                                         |
| `OWNER_PASSWORD_HASH`   | The password those seeded accounts get, as `scrypt$<cost>$<salt>$<hash>`. Generate with `pnpm owner:password <password>`. Not read after that first sign-in — owners change their own password from Settings afterwards                                                                 | Nothing to seed — with no owner accounts yet, nobody can sign in. Once accounts exist, unset has no effect                                         |
| `SITE_ORIGIN`           | Overrides the origin used for the emailed reset/invite link (see **Owner accounts** above) — only matters when the site is served somewhere other than its canonical domain, e.g. a Vercel preview                                                                                      | The link uses this site's own canonical domain                                                                                                     |
| `BLOB_READ_WRITE_TOKEN` | Product photo uploads. The store must be **public** — the storefront links the images directly and the CSP only allows `*.public.blob.vercel-storage.com`                                                                                                                               | The admin's photo-upload card is disabled; it never writes into `public/`                                                                          |
| `STRIPE_SECRET_KEY`     | Creating Checkout Sessions. Use a restricted key (`rk_...`) scoped to write on Checkout Sessions and read on Tax — see **Payments** above                                                                                                                                               | Checkout stays closed; `POST /api/checkout` 503s                                                                                                   |
| `STRIPE_WEBHOOK_SECRET` | Verifying the webhook that marks an order paid and assigns edition numbers                                                                                                                                                                                                              | Checkout stays closed — half a Stripe setup is not enough                                                                                          |
| `RESEND_API_KEY`        | Order confirmation / shipping / pickup emails                                                                                                                                                                                                                                           | Emails are logged, never sent; a missing key never fails a checkout                                                                                |
| `EMAIL_FROM`            | The verified "from" address, e.g. `Chris N Eddy's <orders@chrisneddys.com>`                                                                                                                                                                                                             | As above                                                                                                                                           |
| `OPENAI_API_KEY`        | Writing a new product's search-engine fields the moment it is created — the page title, the meta description, the keywords and the share picture's alt text. Get one from the [OpenAI dashboard](https://platform.openai.com/api-keys). Server-side only; it is never sent to a browser | Nothing breaks: the fields are worked out from the product instead, and an owner can still write or rewrite every one of them by hand in the admin |
| `OPENAI_MODEL`          | Overrides which model writes those fields. The default is a small fast one, which is what four short lines of copy needs; point this at another if you would rather                                                                                                                     | `gpt-5.4-mini` is used                                                                                                                             |
| `NEXT_PUBLIC_GA_ID`     | Overrides the GA4 measurement ID — see **Analytics before launch**                                                                                                                                                                                                                      | The repo default in `Analytics.tsx` is used                                                                                                        |
| `NEXT_PUBLIC_W3F_KEY`   | Web3Forms key for the `/contact/` form                                                                                                                                                                                                                                                  | The form still validates but falls back to mailto/phone                                                                                            |

Two traps worth knowing, both of which have already cost an afternoon:

- **Escape `$` as `\$` in a `.env` file.** Next expands `$NAME` in env values, so
  an unescaped `OWNER_PASSWORD_HASH=scrypt$131072$abc$def` silently becomes
  `scrypt`. That only bites during the first-sign-in seeding described in
  **Owner accounts** above, and it fails with the deliberately unhelpful "That
  email or password isn't right." Quoting does not help; only the backslash
  does.
- **Check the database name in `DATABASE_URL`.** Neon's connection snippet
  defaults to `neondb`, which may not be the database you created for this
  project. Pointing at the wrong one lets `prebuild` create this app's ten
  tables inside somebody else's database.

---

## Vercel

The app now has a server (`next build` / `next start`), so this is a standard
Next.js deployment. The security headers and cache policy above ship from
`headers()` in `next.config.mjs` — one source for every host, Vercel included,
so there is no `vercel.json` to add. `img-src` in that CSP also allows Vercel
Blob (`https://*.public.blob.vercel-storage.com`), where product photos live.

The only thing that still belongs in Vercel's own config is the apex → www
redirect: add both domains in the project's Domains panel and set `www` as
primary — Vercel issues the redirect itself, no `redirects` block needed.

## Netlify / Cloudflare Pages

`public/_redirects` and `public/_headers` are **in the repo** and are copied into
`out/` by the build, so this path needs no config written by hand — check that
both came through (`ls out/_headers out/_redirects`) and that the host is
actually reading them. Neither file does anything on S3 + CloudFront; they are
inert there, which is why they can live in `public/` unconditionally.

Both are commented at the top. `_headers` carries the cache rules from the table
above _and_ the six security headers, because on this host the two are set in the
same place.

## S3 + CloudFront

This is what the previous site ran on, so it is the likely path.

- Serve `out/` from a **private** bucket behind an Origin Access Control, with
  S3 **static-website hosting turned off**. It matters: the bucket serving
  `chrisneddys.com` today has website hosting on with redirect rules, and those
  rules answer `https://chrisneddys.com/contact` with a `302` to
  `/chrisneddys/deployment_20260312131414/contact/` — a dead URL that also
  publishes the deployment key prefix to anyone with `curl`. Delete the routing
  rules and switch the origin to the REST endpoint (`…s3.us-east-1.amazonaws.com`,
  not `…s3-website-…`) so CloudFront, and only CloudFront, decides what a URL
  means.
- Both `chrisneddys.com` and `www.chrisneddys.com` must be alternate domain
  names on the distribution, with a certificate covering both, or the apex never
  reaches the function that redirects it.
- Set the two cache behaviours from the table above: one for `/_next/static/*`
  with a long TTL, the default behaviour short.
- **Invalidate `/*` on every deploy**, or the old HTML is served from cache.

### Response-headers policy

The six headers from **Security headers** above are attached here, not in the
viewer-request function — a CloudFront _function_ cannot add headers to a
response it did not generate, and the 301s it does generate are not the
responses that need them.

Create one **response headers policy** (CloudFront → Policies → Response
headers) and attach it to **both** cache behaviours, the default and
`/_next/static/*`. A policy attached to one does not apply to the other, and the
HTML is the half that matters.

Most of it is fill-in-the-blanks in the console's _Security headers_ panel:

| Console field             | Value                                                         |
| ------------------------- | ------------------------------------------------------------- |
| Strict-Transport-Security | `max-age=31536000`, include subdomains **on**, preload **on** |
| X-Content-Type-Options    | `nosniff` — tick "Override"                                   |
| Referrer-Policy           | `strict-origin-when-cross-origin`                             |
| X-Frame-Options           | `DENY`                                                        |
| Content-Security-Policy   | the one-line CSP from above                                   |

`Permissions-Policy` has no field in that panel — add it under **Custom
headers**, name `Permissions-Policy`, value
`camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()`.

Or, as CLI:

```sh
aws cloudfront create-response-headers-policy \
  --response-headers-policy-config file://response-headers-policy.json
```

Tick **Override** on each one. Without it CloudFront defers to whatever the
origin sent, and S3 sends some of these as empty strings rather than not at all.

One interaction worth knowing before you turn on HSTS `preload`: it is a
commitment, and `includeSubDomains` covers every subdomain including any that
only speaks HTTP today. Check there is no such host before submitting the domain
to the preload list — the header alone is safe and reversible, the list is
neither.

### Viewer-request function

Every URL has exactly one correct spelling — `https://www.chrisneddys.com/menu/`
— and this function is what enforces it. Four rules, in this order:

1. Apex → www, **301**, path and query preserved.
2. `/menu` → **301** `/menu/`. Not a silent rewrite to `/menu/index.html`: a
   rewrite leaves both spellings answering 200 and duplicates all 19 pages.
3. `/menu/index.html` → **301** `/menu/`, for the same reason. `/index.html`
   → `/`.
4. Only then, `/menu/` → origin request for `/menu/index.html`.

The path is normalised _before_ the host is checked, so a request for
`http://chrisneddys.com/menu` costs one redirect rather than two.

Attach it to the default cache behaviour on **viewer request**, runtime
`cloudfront-js-2.0`:

```js
function handler(event) {
  var req = event.request;
  var canonical = "www.chrisneddys.com";
  var host = req.headers.host ? req.headers.host.value.toLowerCase() : "";
  var uri = req.uri;

  // ACME HTTP-01 challenges (cert issuance/renewal) live under this path and
  // must reach the origin exactly as requested — untouched by the host or
  // trailing-slash rules below, which would 301 the validator instead of
  // answering it.
  if (uri.indexOf("/.well-known/") === 0) return req;

  // --- normalise the path ------------------------------------------------
  var target = uri;

  if (target.slice(-11) === "/index.html") {
    // /menu/index.html -> /menu/ ; /index.html -> /
    target = target.slice(0, -10);
  } else if (target.slice(-1) !== "/" && target.lastIndexOf(".") <= target.lastIndexOf("/")) {
    // extensionless, so it is a page, not a file: /menu -> /menu/
    target += "/";
  }

  // --- one canonical URL -------------------------------------------------
  if (host !== canonical || target !== uri) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://" + canonical + target + querystring(req) },
        "cache-control": { value: "public, max-age=3600" },
      },
    };
  }

  // --- and only now, the rewrite ----------------------------------------
  if (target.slice(-1) === "/") req.uri = target + "index.html";

  return req;
}

/** Rebuilds ?a=1&b=2 from the request, so a redirect never drops UTM tags. */
function querystring(req) {
  var q = req.querystring;
  var parts = [];
  for (var key in q) {
    var v = q[key];
    if (v.multiValue) {
      for (var i = 0; i < v.multiValue.length; i++) {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v.multiValue[i].value));
      }
    } else if (v.value === "") {
      parts.push(encodeURIComponent(key));
    } else {
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(v.value));
    }
  }
  return parts.length ? "?" + parts.join("&") : "";
}
```

Anything that is not the canonical host lands in the same 301 — including the
`d111111abcdef8.cloudfront.net` domain, which otherwise gets indexed as a third
copy of the site.

### Custom error responses

A private bucket behind OAC answers a missing key with **403**, not 404, so both
have to be mapped. In the distribution's _Error pages_ tab, add two:

| HTTP error code | Response page path | HTTP response code | Error caching TTL |
| --------------- | ------------------ | ------------------ | ----------------- |
| 403             | `/404.html`        | **404**            | 60                |
| 404             | `/404.html`        | **404**            | 60                |

The response code has to be **404, not 200**. A 200 makes every typo a soft 404:
Google indexes the not-found page, reports "Submitted URL not found (soft 404)",
and the page itself is `noindex` — so it is neither found nor indexable, which is
the worst of both. `out/404.html` is emitted by the build; nothing else is needed.

### Verify

After the first deploy, before submitting anything to Search Console:

```sh
# apex -> www, path kept
curl -sI https://chrisneddys.com/menu/            | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/menu/

# extensionless -> trailing slash
curl -sI https://www.chrisneddys.com/menu         | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/menu/

# index.html -> directory
curl -sI https://www.chrisneddys.com/index.html   | grep -iE '^(HTTP|location)'
#   HTTP/2 301 … location: https://www.chrisneddys.com/

# a URL that does not exist is a 404, not a 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.chrisneddys.com/does-not-exist/
#   404

# and the real page still answers directly
curl -s -o /dev/null -w "%{http_code}\n" https://www.chrisneddys.com/menu/
#   200
```

No `Location` header may contain `deployment_` anywhere in it. If one does, the
S3 website redirect rules are still live.

---

## Analytics before launch

The repo defaults to `G-9WECB13653` (`src/components/shared/Analytics.tsx`,
overridable with `NEXT_PUBLIC_GA_ID`). The Gatsby site on the domain today
reports through `GTM-WQF95WC` into a different measurement ID, `G-QBQRJG4LSQ`.

Before the first production build, open **GA4 Admin → Data streams** and settle
whether those two IDs are two streams of one property or two separate
properties. If they are separate, shipping the default starts a brand-new
history on launch day and orphans everything already in the old one — set
`NEXT_PUBLIC_GA_ID` to the existing ID instead. This is a one-way door: it
cannot be backfilled after the fact.

In the same property, GA4 Enhanced Measurement → "Page changes based on
browser history events" must stay **ON**. This site's `Analytics.tsx` never
calls `gtag('config', …)` again after the first load, so every client-side
route change is a `history.pushState` this setting is what turns into a
`page_view` — turn it off and every SPA navigation after the first stops
being counted.

---

## Launch checklist

Ordered so that nothing is measured after the fact.

- [ ] Walk the site on a phone with `?ga_debug=1` and confirm the six events land
      in GA4 DebugView: `order_click`, `delivery_click`, `call_click`,
      `directions_click`, `menu_item_open`, `contact_submit`.
- [ ] In GA4, mark `order_click`, `delivery_click` and `call_click` as key events.
- [ ] `pnpm check:links`, and open the two bot-blocked delivery URLs by hand.
- [ ] Run the four `curl` checks in **S3 + CloudFront → Verify**: apex → www,
      `/menu` → `/menu/`, `/index.html` → `/`, and an unknown path → `404`.
- [ ] `curl -sI https://www.chrisneddys.com/_next/static/...` → expect
      `immutable`.
- [ ] Ship the CSP as `Content-Security-Policy-Report-Only` first, walk the site
      (home, menu, an item sheet, contact, the shop bag, locations) with the
      console open, and only then rename the header. See **Security headers**.
- [ ] Confirm all six security headers come back on an **HTML** response, not
      just on `/_next/static/*`:
      `curl -sI https://www.chrisneddys.com/ | grep -iE 'strict-transport|content-security|x-content-type|referrer-policy|x-frame|permissions-policy'`
- [ ] Read `/privacy/` against what the site actually does before it goes out —
      it is written from the code, so a new form, a new analytics tool or a
      payment processor in the shop each make it wrong. Confirm the two business
      claims in it hold: that we do not sell personal information, and that
      `chris@chrisneddys.com` is where data requests should land.
- [ ] Verify **both** hosts in Search Console, submit
      `https://www.chrisneddys.com/sitemap.xml`.
- [ ] Google Rich Results Test against `/`, `/menu/`, `/order/` and
      `/locations/hollywood/` — expect Restaurant, Menu, FAQ and Breadcrumb.
- [ ] Google Business Profile: primary category _Hamburger restaurant_, exact
      late-night hours, menu URL `/menu/`, order URL the Otter storefront,
      20–30 photos. **Do not** create listings for Glendale or Van Nuys until
      they open — a premature listing is hard to undo.
- [ ] Once GBP is right, sweep Yelp, Grubhub, Tripadvisor and Apple Maps to the
      same hours. Several currently understate the closing time by an hour or two.
