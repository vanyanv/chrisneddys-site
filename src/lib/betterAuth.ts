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
 * The same per-webpack-layer duplication bites `resetSendStorage` below,
 * for the same reason: `owners.ts`'s `captureResetSend` and this module's
 * own `sendResetPassword` closure need to read and write the *same*
 * `AsyncLocalStorage` instance, but if the two land in different compiled
 * layers, a bare module-scope `new AsyncLocalStorage()` gives each layer
 * its own copy — `captureResetSend` runs `fn` inside *its* copy's context,
 * while `sendResetPassword`'s `resetSendStorage.getStore()` reads from a
 * different, unrelated copy and always sees `undefined`. Proven in the
 * built app (not reproducible under Vitest, which loads the module once):
 * `inviteOwner` always fell through to its "Could not generate an invite
 * link" fallback. Parked on `globalThis` for the same reason `getAuth()`'s
 * promise is.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Db } from "@/db/client";
import * as schema from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

/**
 * What actually happened when `sendResetPassword` (below) tried to email a
 * reset-or-invite link. Captured per call via `captureResetSend` so
 * `src/lib/owners.ts`'s `inviteOwner` can tell the settings page whether the
 * invite was actually emailed — and hand back the link itself when it
 * wasn't, per `src/lib/email.ts`'s `{ sent, reason }` contract.
 */
export type ResetSendOutcome = { to: string; url: string; sent: boolean; reason?: string };

type ResetSendStore = { outcome: ResetSendOutcome | null };

const globalForResetSendStorage = globalThis as unknown as {
  __resetSendStorage?: AsyncLocalStorage<ResetSendStore>;
};

const resetSendStorage: AsyncLocalStorage<ResetSendStore> =
  (globalForResetSendStorage.__resetSendStorage ??= new AsyncLocalStorage<ResetSendStore>());

/**
 * Runs `fn` — an `auth.api.*` call that ends up invoking `sendResetPassword`
 * below (`requestPasswordReset` is the only one that does) — with a scoped
 * slot for that call's send outcome, and returns both. Better Auth awaits
 * `sendResetPassword` in place rather than firing it into a background queue
 * (this instance configures no `advanced.backgroundTasks.handler`, and
 * Better Auth's own `runInBackgroundOrAwait` only backgrounds a call when
 * one is set), so by the time `fn` resolves, the outcome — if `fn` reached
 * `sendResetPassword` at all — is already recorded. `AsyncLocalStorage`
 * rather than a plain module-level variable so two calls in flight at once
 * (unlikely for a single-owner action, but not impossible) never read back
 * each other's outcome.
 */
export async function captureResetSend<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; outcome: ResetSendOutcome | null }> {
  const store: ResetSendStore = { outcome: null };
  const result = await resetSendStorage.run(store, fn);
  return { result, outcome: store.outcome };
}

/** 12 hours, in seconds — see the design doc's "Sessions" section. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

async function buildAuth(db: Db) {
  return betterAuth({
    secret: process.env.AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
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
        const resetUrl = `/admin/reset-password/?token=${encodeURIComponent(token)}`;

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

        const store = resetSendStorage.getStore();
        if (store) store.outcome = { to: user.email, url: resetUrl, ...sendResult };
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
