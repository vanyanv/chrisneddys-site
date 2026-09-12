# chrisneddys.com

Next.js 15 App Router site, static export (`output: "export"`), Tailwind v4,
TypeScript, pnpm. Content lives in `src/data/*.ts`; helpers in `src/lib`;
routes in `src/app`; UI in `src/components`. Deployment and host headers are
documented in `DEPLOY.md`; brand and layout rules in `DESIGN.md`.

## Commands

```
pnpm install
pnpm dev          # local server
pnpm typecheck    # tsc --noEmit
pnpm lint         # next lint
pnpm build        # runs scripts/build-map-base.mjs first, then next build -> out/
pnpm check:links  # verifies order links
```

Run `pnpm typecheck` and `pnpm lint` before reporting any change as done.

## Working in orchestrator mode

For multi-step work, invoke the `orchestrate` skill: the main session plans and
reviews, decides which workers to spawn, and delegates all reading and code
changes to subagents that run on Sonnet (every Agent call passes
`model: "sonnet"`, and `.claude/settings.json` defaults subagents to Sonnet).
Details in `.claude/skills/orchestrate/SKILL.md`.
