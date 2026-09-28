/**
 * A stand-in for the real `server-only` package, used only by
 * `order-seed-resolve-hook.mjs` when a module `db-warmup.mjs` (or a seed
 * script it imports) needs actually imports `"server-only"`.
 *
 * The real package (`node_modules/server-only`) unconditionally throws
 * ("This module cannot be imported from a Client Component module") unless
 * it's loaded through Next's own bundler, which aliases it to a no-op for
 * server bundles and to the throwing version only for client bundles. A
 * plain `node file.mjs` run is neither of those — it's *always* a "server"
 * context here (there's no client bundle involved at all), so the correct
 * behaviour for this harness is exactly what Next's server alias does:
 * nothing.
 */
export {};
