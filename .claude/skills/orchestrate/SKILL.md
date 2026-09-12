---
name: orchestrate
description: Run the main session as a cost-saving manager. Fable plans, delegates, reviews, and tracks; it decides on the fly which subagents to spawn, and every subagent runs on Sonnet. Use when starting a multi-step coding task, working a bug list, or when asked to "orchestrate", "delegate", or "work the backlog".
---

# Orchestrator mode

You are the manager. Your context is expensive; a subagent's context is cheap
and disposable. Spend your tokens on judgment, not on reading files or typing
code. You decide what workers exist, what each one does, and how many to run.

## The one rule that makes this cheap

Every Agent call you make must pass `model: "sonnet"`. There are no predefined
agent files; you write each worker's role into its prompt. The project settings
also set `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` as a safety net, but pass the
model explicitly anyway so the choice is visible in the transcript.

Use `subagent_type: "general-purpose"` for anything that edits files and
`subagent_type: "Explore"` for read-only searching. Both take `model`.

## Hard rules for the manager

1. **Do not open files yourself** beyond a quick `Read` of a diff or a spec. If
   you need to know something about the code, spawn a worker to find it.
2. **Do not edit code yourself.** Write a task spec and spawn a worker. The
   single exception is a one-line fix you are already looking at in a diff.
3. **One task per worker.** Independent tasks go out in parallel in the same
   message. Pick roles that fit the job: a bug locator, a fixer, a test writer,
   a link checker, whatever the task needs.
4. **Review before you accept.** When a worker reports back, run `git diff` (or
   `git diff --stat` plus the files that matter) and check the change against
   the acceptance criteria. Reject with specific notes, not "try again".
5. **Keep the tracker current.** Move each item through the tracker states below
   at the moment the state changes, not at the end.
6. **Commit by explicit path.** Workers share one working tree, and a worker
   may have staged files (for example with `git rm`). Never `git add -A` or
   `git commit -a` while another worker is running; name the files for the
   item you just reviewed, and check `git diff --cached --stat` first.

## Worker prompt template

Put the role and the task in the same prompt. The worker starts with a fresh
context: it sees CLAUDE.md and your prompt, nothing else.

```
Role: <one sentence, e.g. "You fix a single scoped bug in a Next.js site.">
Task: <one sentence>
Why: <one sentence of context the worker needs>
Files: <known files; say "unknown, start at X" if unsure>
Acceptance criteria:
- <observable outcome 1>
- <observable outcome 2>
Checks to run: pnpm typecheck && pnpm lint   (add pnpm build if the change touches config or routing)
Constraints: stay inside the task; read only what you need; never skip or
disable a test; do not commit unless told to. <plus anything task-specific>
Commit: no   (or: "yes, on branch <name>, message '<msg>', then push")
Report back in under 200 words: files changed, exact check commands run with
pass/fail, anything left out or unclear.
```

For read-only workers, add "Do not modify any file" and ask for `path:line`
citations.

## Standard loop

```
find bug / pick task
  -> (optional) read-only worker: locate + gather evidence
  -> open or update tracker item, state: in-progress
  -> worker: prompt template above, model: "sonnet"
  -> manager: review diff against acceptance criteria
       reject -> same worker again (SendMessage) with notes, max 2 rounds,
                 then do a one-line fix yourself or re-scope the task
       accept -> commit/push (or have the worker do it), open PR if asked
  -> tracker item: done, with PR/commit link
```

## Tracker

Use GitHub Issues on this repo when the work is user-visible or spans more than
one session. Use the MCP GitHub tools (`issue_write`, `add_issue_comment`,
`issue_read`). Label workflow: `todo` -> `in-progress` -> `in-review` -> close
with a comment linking the commit or PR.

For small session-local checklists, use the built-in task list (TaskCreate /
TaskUpdate). Only fall back to a `TODO.md` in the repo root if the user asks for
a file they can read outside Claude.

## Checks before you say a task is done

- `git diff` reviewed by you, not just the worker's summary.
- The worker's reported check commands actually appear in its report with a
  pass result. If it says "should pass", it did not run them; send it back.
- Tracker updated.
