# Owner accounts on Better Auth

Design for [#33](https://github.com/vanyanv/chrisneddys-site/issues/33).
Replaces the hand-rolled admin auth with Better Auth: per-owner accounts,
change password, reset by email, and invites.

## Why

Admin auth today is one shared password in an environment variable, verified
against `OWNER_PASSWORD_HASH` and carried in a stateless 30-day JWT. Three
things follow from that, and all three are the reason for this change:

- Changing the password means editing Vercel and redeploying. Forgetting it
  means editing the database.
- Sessions cannot be revoked. `signOut()` deletes the cookie
  (`src/lib/auth.ts:184-186`); a copy of the token keeps verifying until its
  30-day `exp`.
- Everyone shares one credential, so "who did this" has no answer and removing
  a person means rotating for everybody.

The additions the owner actually asked for — reset links, invites, revocation —
are exactly the features where hand-rolled auth accumulates bugs, so they go on
a library rather than into `src/lib/auth.ts`.

## What exists today

| Piece           | Where                                                 | Behaviour                                                                                                                              |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in action  | `src/app/(admin)/admin/actions.ts:16-27`              | `signInAction` -> `signIn(email, password)`                                                                                            |
| Sign-in         | `src/lib/auth.ts:107-181`                             | Compares against the single `OWNER_PASSWORD_HASH`; allowlist is the `owners` table, or `OWNER_EMAILS` when that table is empty         |
| Hashing         | `src/lib/password.ts:14-15`                           | scrypt N=16384, r=8, p=1, 64-byte key; stored `scrypt$<saltHex>$<hashHex>`                                                             |
| Session         | `src/lib/sessionToken.ts`                             | Stateless HS256 JWT (`jose`) signed with `AUTH_SECRET`; cookie `cne_owner`, 30 days                                                    |
| Edge guard      | `middleware.ts:23-51` (repo root, not `src/`)         | Matcher `/admin/:path*` + `/shop/thanks`; verifies the JWT, 307s to `/admin/sign-in?next=`                                             |
| Throttle        | `src/lib/signInThrottle.ts`, `sign_in_attempts` table | 5 failures per email or IP in 15 minutes                                                                                               |
| Allowlist parse | `src/lib/ownerAllowlist.ts`                           | `parseOwnerEmails(OWNER_EMAILS)`                                                                                                       |
| Owners table    | `src/db/schema.ts:172-177`                            | id, email unique, name, createdAt — no password column                                                                                 |
| Email           | `src/lib/email.ts:107-135`                            | Private `sendViaResend(to, subject, text)` behind `RESEND_API_KEY` + `EMAIL_FROM`; three order senders; never throws when unconfigured |
| Break-glass     | `scripts/owner-password.mjs`                          | Prints an `OWNER_PASSWORD_HASH=` line to paste into the env by hand                                                                    |

Migrations run to `drizzle/0005_dashing_sasquatch.sql`, so this work adds
`0006`. `getDb()` is **async** (`src/db/client.ts:167-170`) and returns a
`PgDatabase` over Neon (`DATABASE_URL` set) or PGlite (dev and Vitest).

## What the owner gets

- Each owner has their own account and password in the database.
- **Change password** from `/admin/settings`. It signs out every other device.
- **Forgot password** emails a one-hour, single-use link. Until Resend is
  configured the sign-in page says so rather than pretending to send.
- **Invite an owner** from settings; the invitee sets their own password from
  an emailed link. **Remove an owner** from the same card — never the last one,
  never yourself.
- Admin sessions last 12 hours, are stored server-side, and can be revoked.
- Hashing moves to scrypt N=2^17 (OWASP's current floor). An existing
  `scrypt$...` hash still verifies and is rehashed on first sign-in.
- You sign in with the password you already have: `OWNER_PASSWORD_HASH` seeds
  the first account, then is never read again.

## Shape of the change

Better Auth with the Drizzle adapter, the email/password provider, and
**no public auth route**. Every call goes through server actions that invoke
`auth.api.*` directly, so `/api/auth/*` is never mounted and the existing
`middleware.ts` matcher does not have to grow.

### Tables (migration `0006`)

Better Auth's four core tables, added to `src/db/schema.ts` so Drizzle owns
them like every other table:

- `user` — id, email (unique), name, emailVerified, image, timestamps
- `session` — id, userId, token (unique), expiresAt, ipAddress, userAgent
- `account` — id, userId, providerId, accountId, password, timestamps
- `verification` — id, identifier, value, expiresAt, timestamps

`owners` is dropped in the same migration; the `user` table replaces it as the
allowlist. `sign_in_attempts` and `src/lib/signInThrottle.ts` stay exactly as
they are — Better Auth's own rate limiting is off, and the existing throttle
keeps wrapping sign-in so its tests keep passing.

### Password hashing

`src/lib/password.ts` is rewritten to scrypt **N=131072, r=8, p=1**, 64-byte
key, and gains a `maxmem` high enough for N=2^17 (Node's default 32 MB is not).
The stored format keeps its `scrypt$<saltHex>$<hashHex>` shape but records the
cost, so both generations are distinguishable and a legacy hash still verifies:

- `hashPassword(pw)` -> `scrypt$131072$<salt>$<hash>`
- `verifyPassword(pw, stored)` accepts the 3-field legacy form (N=16384) and
  the 4-field new form, and reports which it matched so the caller can rehash.

Better Auth is configured with these as its `password.hash` / `password.verify`,
so there is exactly one hasher in the codebase.

### Sessions

12-hour expiry, database-backed. The cookie name stays whatever Better Auth
uses; `requireOwner()` and `getOwnerSession()` (`src/lib/auth.ts:71-91`) are
re-pointed at `auth.api.getSession`, keeping their current signatures so no
caller changes. `signOut` revokes the session row rather than only clearing a
cookie. `src/lib/sessionToken.ts` and its JWT are deleted.

Middleware cannot reach the database at the edge, so it does a **presence
check** on the session cookie and lets the server-side `requireOwner()` do the
real verification — the same redirect behaviour, one cheap check earlier. This
is the one place the change is weaker than the JWT it replaces, and it is only
weaker against a forged cookie value, which `requireOwner()` then rejects
before any admin data is read.

### Bootstrap and the env vars

On first sign-in, if `user` is empty and `OWNER_PASSWORD_HASH` + `OWNER_EMAILS`
are set, seed one account per allowlisted email with that hash. After that the
two env vars are ignored; `AUTH_SECRET` stays (Better Auth signs with it).
Nothing in Vercel has to change for the site to keep working.

### Email

`src/lib/email.ts` exports its existing low-level sender as `sendEmail` and
gains `sendPasswordReset(to, url)` and `sendOwnerInvite(to, url)`. Both are
plain text with a single link, and both inherit the rule that an unconfigured
Resend logs instead of throwing. The settings and sign-in pages read that
`{ sent: false, reason }` and say so rather than claiming an email went out.

## Assumptions the spike must prove before anything is built on them

These are load-bearing. T1 answers each with a committed test, not a reading of
the docs:

1. **A1** `auth.api.signInEmail` / `getSession` / `changePassword` work when
   called from a server action with the route handler never mounted.
2. **A2** A reset link works for an account created **without** a password —
   i.e. an invite is just "create user, send reset", not a separate flow.
3. **A3** How the Drizzle adapter takes an **async** `getDb()`: whether the
   `auth` instance can be built lazily per request, and what that costs.
4. **A4** A custom `password.hash`/`verify` can be supplied, and a legacy
   3-field hash verifies through it and is rehashed on success.
5. **A5** The edge-safe way to read the session cookie in `middleware.ts`
   without importing the Node-only `auth` instance.

If A2 is false, invites become their own token flow and T3a grows. If A3 forces
a per-request instance, every `auth.api.*` call site takes an `await`. Nothing
downstream starts until these have answers.

## Work breakdown

| Task    | Scope                                                                                                                 | Depends on |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| T1      | Install Better Auth, rewrite `password.ts`, 4 tables + migration `0006`, `src/lib/betterAuth.ts`, tests proving A1-A5 | —          |
| T-email | `sendEmail`, `sendPasswordReset`, `sendOwnerInvite` + tests                                                           | —          |
| T4      | `owner-password.mjs --apply`, DEPLOY.md "Owner accounts", CHANGELOG, CLAUDE.md, `.env.local` comments                 | —          |
| T2      | Point `auth.ts` + `middleware.ts` at the instance; bootstrap; legacy rehash; drop `owners`                            | T1         |
| T3a     | Settings: change-password and owners cards                                                                            | T2         |
| T3b     | `/admin/forgot-password` and `/admin/reset-password` pages                                                            | T2         |
| T5      | Playwright specs across sign-in, change password, reset, invite, remove                                               | T3a, T3b   |

Every task commits and pushes to `claude/auth-refactor-parallel-0jrtw7` as it
lands. Nothing is held locally.

## Out of scope

Two-factor, OAuth providers, per-owner roles or permissions, customer-facing
accounts, and any change to how `/shop` works. Sign-in throttling keeps its
current implementation rather than moving to Better Auth's.
