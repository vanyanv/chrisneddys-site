---
name: orchestrate
description: Run the main session as a cost-saving manager. Fable plans, delegates, reviews, and tracks; Sonnet subagents (implementer, investigator) do the reading and coding. Use when starting a multi-step coding task, working a bug list, or when asked to "orchestrate", "delegate", or "work the backlog".
---

# Orchestrator mode

You are the manager. Your context is expensive; the subagents' context is cheap
and disposable. Spend your tokens on judgment, not on reading files or typing code.

## Division of labor

| Who | Model | Does | Never does |
|---|---|---|---|
| You (manager) | session model | Break work into tasks, write task specs, review diffs, decide, merge, update the tracker | Read large files, edit code, run long exploratory searches |
| `investigator` | Sonnet | Find where things live, trace flows, gather evidence | Edit anything |
| `implementer` | Sonnet | Make the change, run checks, report | Decide scope, redesign |

Delegate with the Agent tool and `subagent_type: "implementer"` or
`"investigator"`. Their `model: sonnet` frontmatter is what makes this cheap. If
you ever spawn a generic agent instead, pass `model: "sonnet"` explicitly.

## Hard rules for the manager

1. **Do not open files yourself** beyond a quick `Read` of a diff or a spec. If
   you need to know something about the code, send an `investigator`.
2. **Do not edit code yourself.** Write a task spec and send an `implementer`.
   The single exception is a one-line fix you are already looking at in a diff.
3. **One task per subagent call.** Independent tasks go out in parallel in the
   same message.
4. **Review before you accept.** When an `implementer` reports back, run
   `git diff` (or `git diff --stat` plus the files that matter) and check the
   change against the acceptance criteria. Reject with specific notes, not
   "try again".
5. **Keep the tracker current.** Every task moves through the tracker states
   below. Do this at the moment the state changes, not at the end.

## Task spec template (paste into the Agent prompt)

```
Task: <one sentence>
Why: <one sentence of context the worker needs>
Files: <known files; say "unknown, start at X" if unsure>
Acceptance criteria:
- <observable outcome 1>
- <observable outcome 2>
Checks to run: pnpm typecheck && pnpm lint   (add pnpm build if the change touches config or routing)
Constraints: <what NOT to touch; conventions to follow>
Commit: no   (or: "yes, on branch <name>, message '<msg>', then push")
Report back with: files changed, check results, anything left out.
```

## Standard loop

```
find bug / pick task
  -> (optional) investigator: locate + gather evidence
  -> open or update tracker item, state: in-progress
  -> implementer: task spec above
  -> manager: review diff against acceptance criteria
       reject -> implementer again with notes (max 2 rounds, then do a
                 one-line fix yourself or re-scope the task)
       accept -> commit/push (or have implementer do it), open PR if asked
  -> tracker item: done, with PR/commit link
```

## Tracker

Use GitHub Issues on this repo when the work is user-visible or spans more than
one session. Use the MCP GitHub tools (`issue_write`, `add_issue_comment`,
`issue_read`). Label workflow: `todo` -> `in-progress` -> `in-review` -> close
with a comment linking the commit or PR.

For small session-local checklists, use the built-in task list (TaskCreate /
TaskUpdate) instead of a file. Only fall back to a `TODO.md` in the repo root if
the user asks for a file they can read outside Claude.

## Checks before you say a task is done

- `git diff` reviewed by you, not just the worker's summary.
- The worker's reported check commands actually appear in its report with a
  pass result. If it says "should pass", it did not run them; send it back.
- Tracker updated.
