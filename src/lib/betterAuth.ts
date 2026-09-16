/**
 * The Better Auth instance for owner sign-in — see
 * `docs/superpowers/specs/2026-09-14-better-auth-owner-sign-in-design.md`.
 *
 * Deliberately **not** mounted as a route: no `/api/auth/*` handler exists
 * anywhere in `src/app`. Every caller (a later task re-points `src/lib/
 * auth.ts` at this) invokes `auth.api.*` directly from server-side code —
 * `src/lib/betterAuth.spike.test.ts` (A1) proves that works.
 *
 * **Why `getAuth()` and not a plain exported `auth`:** the Drizzle adapter
 * (`drizzleAdapter(db, config)`) takes an already-connected `db`, not a
 * promise of one, and `getDb()` (`src/db/client.ts`) is async — Postgres
 * (Neon) in deployed environments, PGlite locally/in tests, resolved lazily
 * the first time anything needs it. There is no synchronous `db` to hand the
 * adapter at module-evaluation time.
 *
 * A3's answer: build once, lazily, and cache the *promise* — the same
 * "module-level singleton behind an async getter" shape `getDb()` itself
 * already uses, right down to parking it on `globalThis` rather than a plain
 * module-scope `let`. That parking matters for the same reason it does in
 * `src/db/client.ts`: under `next dev`, the App Router compiles this module
 * once per webpack layer (RSC, SSR, Server Actions), so a bare module-scope
 * singleton would still let two independent Better Auth instances — each
 * with its own Drizzle adapter over its own resolved `db` — exist in the
 * same process. `globalThis` is the one object every layer shares.
 *
 * `betterAuth.spike.test.ts` proves the "singleton" half of that (A3):
 * concurrent `getAuth()` calls resolve to the *same* instance rather than
 * building it twice. Nothing here needs to be built per request.
 *
 * The same per-webpack-layer duplication used to bite the way `owners.ts`'s
 * `captureResetSend` learns what `sendResetPassword` (below) actually did:
 * an earlier version held that outcome in an `AsyncLocalStorage`, and if the
 * `run()` call and the matching `getStore()` read landed in two different
 * compiled layers' copies of this module, the read always saw `undefined`
 * — proven in the built app (not reproducible under Vitest, which loads the
 * module once), where `inviteOwner` always fell through to its "Could not
 * generate an invite link" fallback. Parking that storage on `globalThis`,
 * the same way `getAuth()`'s promise is, fixed the sharing problem, but
 * `resetSendOutcomes` below goes a step further and drops `AsyncLocalStorage`
 * entirely: a plain `Map` keyed by email, read back with a synchronous
 * lookup, has nothing that depends on an async context surviving a layer
 * boundary in the first place — see that constant's own comment.
 */
import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { absoluteUrl } from "@/lib/siteOrigin";

/**
 * What actually happened when `sendResetPassword` (below) tried to email a
 * reset-or-invite link. Captured per call via `captureResetSend` so
 * `src/lib/owners.ts`'s `inviteOwner` can tell the settings page whether the
 * invite was actually emailed — and hand back the link itself when it
 * wasn't, per `src/lib/email.ts`'s `{ sent, reason }` contract.
 */
export type ResetSendOutcome = { to: string; url: string; sent: boolean; reason?: string };

/**
 * Where `sendResetPassword` (below) leaves its outcome for `captureResetSend`
 * to read back — a plain `Map` keyed by the normalized email, not an
 * `AsyncLocalStorage`. See this file's module comment for why: Next can
 * compile this module once per webpack layer, and an `AsyncLocalStorage`
 * context started in one layer's copy is never visible to a `getStore()` in
 * another layer's copy. A `Map` sidesteps that question entirely — every
 * layer's copy reads `globalForResetSendOutcomes.__resetSendOutcomes`, so
 * they all resolve to the exact same object no matter how many times the
 * module itself gets re-evaluated, and reading an entry back is an ordinary
 * synchronous lookup rather than something that has to keep threading
 * through every `await` between the write and the read.
 *
 * Keyed by email rather than a per-call token because the hook only ever
 * receives `user.email`, nothing that identifies which caller started the
 * request. `inviteOwner` already refuses a second invite to an email that's
 * still mid-flight, so two genuinely concurrent writes for the same key
 * aren't a realistic case here. An entry nobody ever reads back — a plain
 * "forgot password" request, which doesn't go through `captureResetSend` at
 * all — expires off a short timer instead of sitting in memory forever.
 */
const globalForResetSendOutcomes = globalThis as unknown as {
  __resetSendOutcomes?: Map<string, ResetSendOutcome>;
};

const resetSendOutcomes: Map<string, ResetSendOutcome> =
  (globalForResetSendOutcomes.__resetSendOutcomes ??= new Map());

const RESET_SEND_OUTCOME_TTL_MS = 30_000;

function normalizeResetSendKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Records `outcome` for `email`, self-cleaning after `RESET_SEND_OUTCOME_TTL_MS`
 * if nothing ever claimed it (see the map's own comment above). */
function rememberResetSendOutcome(email: string, outcome: ResetSendOutcome): void {
  const key = normalizeResetSendKey(email);
  resetSendOutcomes.set(key, outcome);
  const timer = setTimeout(() => {
    if (resetSendOutcomes.get(key) === outcome) resetSendOutcomes.delete(key);
  }, RESET_SEND_OUTCOME_TTL_MS);
  timer.unref?.();
}

/**
 * Runs `fn` — an `auth.api.*` call that ends up invoking `sendResetPassword`
 * below for `email` (`requestPasswordReset` is the only one that does) —
 * and returns both its result and whatever outcome that hook recorded for
 * `email`. Better Auth awaits `sendResetPassword` in place rather than
 * firing it into a background queue (this instance configures no
 * `advanced.backgroundTasks.handler`, and Better Auth's own
 * `runInBackgroundOrAwait` only backgrounds a call when one is set), so by
 * the time `fn` resolves, the outcome — if `fn` reached `sendResetPassword`
 * at all — is already recorded. Clears any stale leftover for `email` first
 * so a previous, unclaimed write (say, an earlier "forgot password" attempt
 * for the same address) can never be mistaken for this call's own outcome.
 */
export async function captureResetSend<T>(
  email: string,
  fn: () => Promise<T>,
): Promise<{ result: T; outcome: ResetSendOutcome | null }> {
  const key = normalizeResetSendKey(email);
  resetSendOutcomes.delete(key);
  const result = await fn();
  const outcome = resetSendOutcomes.get(key) ?? null;
  if (outcome) resetSendOutcomes.delete(key);
  return { result, outcome };
}

/** 12 hours, in seconds — see the design doc's "Sessions" section. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

async function buildAuth(db: Db) {
  return betterAuth({
    secret: process.env.AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // A reset is the flow an owner uses when they think a session was
      // stolen, so every session that existed under the old password must
      // die along with it — otherwise whoever it is stays signed in right
      // through the "fix". Better Auth's own `resetPassword` handler
      // (`node_modules/better-auth/dist/api/routes/password.mjs`) does this
      // for us when the flag is on: `deleteUserSessions(userId)` runs
      // inside the same handler that already resolved the token to a user,
      // right after the new password is set.
      revokeSessionsOnPasswordReset: true,
      // A4: Better Auth calls these instead of its own built-in scrypt, so
      // there is exactly one hasher in the codebase — and `verifyPassword`
      // already accepts both the legacy 3-field hash and the current
      // 4-field one, so a stored legacy hash verifies through Better Auth
      // too, with no migration step required up front.
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(password, hash),
      },
      // Imported lazily (rather than at module scope) so this file can
      // still be imported into a plain Vitest module — as
      // `betterAuth.spike.test.ts` does — without pulling in
      // `src/lib/email.ts`'s `import "server-only"` before anything
      // actually needs it.
      sendResetPassword: async ({ user, token }) => {
        const { sendPasswordReset, sendOwnerInvite } = await import("@/lib/email");

        // Deliberately building this link ourselves from `token` instead of
        // using the `url` Better Auth hands the callback: that `url` always
        // points at Better Auth's own GET `/reset-password/:token` redirect
        // callback (`requestPasswordResetCallback`, in
        // `node_modules/better-auth/dist/api/routes/password.mjs`) — a
        // route this app deliberately never mounts (see this file's module
        // comment: no `/api/auth/*` handler exists anywhere in `src/app`),
        // so visiting it 404s. The real page an owner resets their password
        // on is `src/app/(admin)/admin/reset-password/page.tsx`, which reads
        // the token from a plain `?token=` query param and — per that
        // route's own `actions.ts` — calls `auth.api.resetPassword({ body:
        // { token, newPassword } })` directly, never through Better Auth's
        // callback route either. So the link this app needs has always been
        // `/admin/reset-password/?token=<token>`, not Better Auth's default.
        //
        // Built absolute via `absoluteUrl` (`src/lib/siteOrigin.ts`):
        // root-relative resolves fine on the settings page (which has its
        // own origin to resolve against) but an email client has none, so a
        // relative link here would render as literal, unclickable text in
        // the inbox this is actually meant to reach.
        const resetUrl = absoluteUrl(`/admin/reset-password/?token=${encodeURIComponent(token)}`);

        // An invited owner has a `user` row with no matching `account` row
        // at all — that absence is exactly "has never set a password",
        // which is what an invite *is* (see the design doc's A2 finding:
        // inviting is just "create user, send reset"). Everyone else is
        // asking to replace a password they already have.
        const [credentialAccount] = await db
          .select({ id: schema.account.id })
          .from(schema.account)
          .where(
            and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")),
          );

        const sendResult = credentialAccount
          ? await sendPasswordReset(user.email, resetUrl)
          : await sendOwnerInvite(user.email, resetUrl);

        rememberResetSendOutcome(user.email, { to: user.email, url: resetUrl, ...sendResult });
      },
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
    },
  });
}

export type Auth = Awaited<ReturnType<typeof buildAuth>>;

const globalForAuth = globalThis as unknown as { __betterAuthPromise?: Promise<Auth> | null };

/**
 * The configured Better Auth instance, built once (per process) the first
 * time anything calls this, and reused after that — see the module comment
 * above for why an async getter rather than a plain export.
 */
export function getAuth(): Promise<Auth> {
  if (!globalForAuth.__betterAuthPromise) {
    globalForAuth.__betterAuthPromise = getDb().then(buildAuth);
  }
  return globalForAuth.__betterAuthPromise;
}
