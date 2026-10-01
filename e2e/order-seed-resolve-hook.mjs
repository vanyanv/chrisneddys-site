/**
 * A tiny custom ESM resolution hook, registered by `db-warmup.mjs` before it
 * imports `src/lib/orders.ts` — the only thing standing between that file's
 * plain `node file.mjs` execution and successfully seeding orders through
 * the *same* functions the app itself calls (`createPendingOrder`,
 * `markPaid`, `setFulfilment`, `markReadyForPickup`), rather than
 * reimplementing that state machine here.
 *
 * Fixes two specifiers plain Node can't resolve on its own, neither of
 * which `src/db/client.ts`/`src/db/schema.ts` (the modules `db-warmup.mjs`
 * already imported successfully before this file existed) happen to need:
 *
 * 1. `@/...` — `tsconfig.json`'s path alias to `./src/...`. Node's native
 *    TypeScript support (used today to import `../src/db/client.ts`
 *    directly) strips types but doesn't read `tsconfig.json`'s `paths`, so
 *    a bare `@/db/client` specifier is otherwise unresolvable outside
 *    Next's own bundler/Vitest's resolver.
 * 2. `next/cache` — `orders.ts` imports `revalidatePath`/`revalidateTag`
 *    from it (for a code path — `catalogueChanged`, called only from the
 *    Stripe webhook route — that none of the seeding functions this file
 *    calls ever reach). `next`'s package.json has no `exports` map, so
 *    Node's ESM resolver won't auto-append `.js` to a subpath import the
 *    way CommonJS `require` would; it just needs a nudge to find
 *    `next/cache.js`, which is right there on disk.
 * 3. `server-only` — several `src/lib/**` modules (`service.ts` among them)
 *    import it as a guard against being bundled into client code; Next's
 *    bundler aliases the real package to a no-op for a server build and to
 *    a throwing stub only for a client build. Plain `node` isn't either of
 *    those bundles, so it loads the real npm package, which throws
 *    unconditionally outside that bundler aliasing — this redirects the
 *    specifier to `server-only-stub.mjs` (a genuine no-op) instead, which
 *    is the correct behaviour for a script that, like a server build, never
 *    ships anything to a browser.
 * 4. Extensionless relative specifiers (`./pricing`, `../lib/x`) — plain
 *    TypeScript-style imports, valid under `tsconfig.json`'s module
 *    resolution and under Next's bundler, but not under Node's own ESM
 *    resolver, which never infers an extension for a relative specifier.
 *    `src/db/client.ts`/`schema.ts` (imported with an explicit `.ts`
 *    already) happen not to need this, but a `src/lib` module that imports
 *    a sibling as `./pricing` would — this widens the same "try appending an extension" fallback the `@/...` case above
 *    already does, resolved against the importing file instead of
 *    `srcRoot`.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(projectRoot, "src");

const serverOnlyStub = join(projectRoot, "e2e", "server-only-stub.mjs");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return nextResolve(pathToFileURL(serverOnlyStub).href, context);
  }

  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    for (const candidateSuffix of ["", ".ts", ".tsx", "/index.ts"]) {
      const candidate = join(srcRoot, rel + candidateSuffix);
      // A file, not a directory: `@/lib/orders` is `src/lib/orders.ts`, next
      // to the `src/lib/orders/` folder it re-exports from.
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const isModuleNotFound =
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ERR_MODULE_NOT_FOUND";
    if (!isModuleNotFound) throw err;

    if (specifier.startsWith("next/")) {
      return nextResolve(`${specifier}.js`, context);
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[a-zA-Z0-9]+$/.test(specifier)
    ) {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      for (const candidateSuffix of [".ts", ".tsx", "/index.ts"]) {
        const candidate = join(parentDir, specifier + candidateSuffix);
        if (existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }

    throw err;
  }
}
