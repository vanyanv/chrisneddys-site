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
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(projectRoot, "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    for (const candidateSuffix of ["", ".ts", ".tsx", "/index.ts"]) {
      const candidate = join(srcRoot, rel + candidateSuffix);
      if (existsSync(candidate)) {
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
    if (specifier.startsWith("next/") && isModuleNotFound) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}
