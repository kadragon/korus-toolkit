# Workflows

The repository currently uses a small backlog/Sprint Contract cycle. Keep work inline by default; use built-in exploration only when the operator authorizes it and an objective scope gate fires.

## `plan`

1. Write `docs/design/<feature>.md` only for a multi-session or architectural decision.
2. Record observed KORUS behavior, security impact, scope, exclusions, and open decisions.
3. Promote one-line approved work to `backlog.md` under `## Now`.
4. Append the closed item to `CHANGELOG.md` under `## Unreleased` as `- [done] <title> (<YYYY-MM-DD>) → <path to design doc, or omit>`.

## `code`

0. Ensure a task branch; never edit on `main`/`master`.
1. Define a Sprint Contract in temporary `tasks.md`: scope, exclusions, testable acceptance criteria, and evaluator feedback.
2. Reproduce bugs first when test infrastructure exists. Otherwise define observable verification before editing.
3. Implement the minimum diff. An authorized built-in exploration pass is available only when the global objective delegation gate fires; no named project agent is required.
4. Verify independently against every criterion. A failed criterion remains open; do not average it away.
5. Run `tools/check-principles.ps1` when product files or a manifest exist.
6. Close the sprint only after acceptance evidence is recorded; remove `tasks.md` at close and keep persistent follow-ups in `backlog.md`.

## `draft`

Update docs from observed code, config, and user decisions. No production-code edits. Missing behavior becomes a backlog item.

## `constrain`

Write a structural test, checker, or settings deny first. If current code violates it, record remediation rather than making unrelated fixes. Update the owning doc after the constraint is observable.

## `explore`

State the question, inspect read-only, report evidence and tradeoffs, and do not commit. Approved results flow into `plan` or `code`.

## `sweep` (deferred)

No sweep script is installed yet. Add one after the first confirmed doc-drift, principle-violation, or harness-freshness signal; record its trigger in `docs/runbook.md`.

## Context Continuity

For long work, create a session-scratchpad `handoff-<feature>.md` with Objective, Completed Phases, Current Phase, Open Questions, External State, and the four-field Next Agent Contract. Scratchpad is ephemeral; no cross-session resume.
