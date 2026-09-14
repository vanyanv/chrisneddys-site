# chrisneddys.com

Next.js 15 App Router site on Vercel, Tailwind v4, TypeScript, pnpm. Storefront
pages are static with revalidation; `/admin` and `/api` are server routes
(middleware-protected sign-in, Stripe checkout/webhook). The catalogue and
orders live in Postgres — Neon in deployed environments, PGlite locally and
in tests — with `src/data/merch.ts` as seed source and static fallback when
there's no database to talk to. Content lives in `src/data/*.ts`; helpers in
`src/lib`; routes in `src/app`; UI in `src/components`. Deployment and host
headers are documented in `DEPLOY.md`; brand and layout rules in `DESIGN.md`.

## Commands

```
pnpm install
pnpm dev             # local server
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint .
pnpm test            # vitest run
pnpm format:check    # prettier --check (pre-commit hook formats staged files)
pnpm build           # runs scripts/build-map-base.mjs + db-prepare.mjs, then next build -> .next/
pnpm check:links     # verifies order links
pnpm db:generate     # drizzle-kit generate -> drizzle/*.sql (commit the output)
pnpm db:migrate      # apply pending migrations (also runs on build via db-prepare.mjs)
pnpm db:seed         # upsert the seed catalogue
pnpm db:studio       # drizzle-kit studio
pnpm owner:password  # print an OWNER_PASSWORD_HASH for a given password
```

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` before
reporting any change as done.

## Store

The catalogue is `src/lib/catalog.ts`; orders, reservations and payment are
`src/lib/orders.ts`. Environment variables and the database/payments setup
they depend on are documented in `DEPLOY.md`'s "Database" and "Payments"
sections.

## Working in orchestrator mode

For multi-step work, invoke the `orchestrate` skill: the main session plans and
reviews, decides which workers to spawn, and delegates all reading and code
changes to subagents that run on Sonnet (every Agent call passes
`model: "sonnet"`, and `.claude/settings.json` defaults subagents to Sonnet).
Details in `.claude/skills/orchestrate/SKILL.md`.

## Tracking fixes

Every user-visible fix gets a GitHub issue. Labels move `todo` -> `in-progress`
-> `in-review`; close the issue with a comment linking the commit or PR that
fixed it. Commit messages reference the issue number (e.g. `fixes #11`).

In the same commit as the fix, add a line to `CHANGELOG.md` under
`[Unreleased]` (`### Fixed`, `### Added`, or `### Changed`) with the issue
link, following Keep a Changelog format.

When a batch of fixes is deployed: bump `version` in `package.json`, move the
`Unreleased` section into a new dated section, and tag the release
`vX.Y.Z`, then start a fresh empty `## [Unreleased]` section for the next fix.
