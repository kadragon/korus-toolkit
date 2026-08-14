# KORUS Toolkit Agent Rules

Browser-extension repository targeting `https://knue.korus.ac.kr/`. Stack is decided in `docs/design/chrome-extension-stack.md` (Chromium — Chrome and Edge — Manifest V3, Vite, TypeScript, pnpm). Never infer a runtime, manifest version, package manager, command, or version not recorded there; no scaffold exists yet, so build/test commands stay unverified.

## Docs Index (read on demand)

| File | When to read |
|------|--------------|
| `docs/architecture.md` | Before selecting source boundaries or changing trust boundaries |
| `docs/conventions.md` | Before adding extension code or changing Git conventions |
| `docs/workflows.md` | When starting or closing a planned work cycle |
| `docs/eval-criteria.md` | When defining or grading Sprint Contract completion |
| `docs/runbook.md` | For verified checks, setup, and failure modes |
| `docs/harness-log.md` | When changing harness structure or retiring an asset |
| `docs/design/chrome-extension-stack.md` | Before scaffolding the extension or changing stack, browser targets, or test tooling |
| `docs/design/korus-mail-prefill.md` | Before changing the KORUS mail workflow contract or prefill behavior |

## Golden Principles

1. **Exact origin scope** — host permissions may cover only `https://knue.korus.ac.kr/*`; `tools/check-principles.ps1` checks manifest patterns when a manifest exists.
2. **No institutional secrets** — credentials, cookies, tokens, and captured KORUS data never enter Git, logs, fixtures, or telemetry; the checker catches obvious patterns and review handles semantic leaks.
3. **Least privilege** — every extension permission needs an exercised code path and documented rationale; broad permissions require explicit approval.
4. **Fabrication ban** — If you have not directly read the value from a file, command output, or tool result in this session, you must not state it as fact. Write `[unknown — read {source} to verify]` instead. Applies to: port numbers, API endpoints, schema fields, config values, version numbers, feature flags.

## Delegation

Default inline. No named project roles or orchestrator installed. Fan out only with user/session authorization and when the global objective gate fires: 10+ files to read/summarize, 3+ independent units, output would flood context, or work outlives one context. `dev:harness-curate` adds a named role only after transcripts show recurring delegated work; keep any future routing row aligned with an existing file and the higher-precedence inline-default rule.

<!-- harness:verbatim — mandated block, exempt from the non-inferability filter. Do not trim or paraphrase. -->
## Token Economy

Rules that apply every message — keep the context window lean.

1. Do not re-read a file already read in this session. If you need to check a change, read only the diff/region.
2. Do not call tools just to confirm information you already have. Simple questions deserve direct answers.
3. Run independent tool calls in parallel (multiple reads, grep + glob, etc.) — not sequentially.
4. Delegate any analysis that would produce >20 lines of output to a sub-agent; return only the conclusion to this context.
5. Do not restate what the user just said. They can read their own message.

## Working with Existing Code

- Preserve user changes; inspect status before editing.
- Use `rg` / `rg --files` first. Prefer existing code, stdlib, platform APIs, installed dependencies, then minimum new code.
- Run `tools/check-principles.ps1` before commit once product files exist.
- Never commit on `main`/`master`; create one branch per task. Commit format: `[TYPE] description` in `docs/conventions.md`.

## Language Policy

- Code, commits, comments, and repository docs: English.
- User-facing narration: Korean, terse.
- Matcher text and trigger phrases may include Korean plus English because the operator prompts in both.

## Platform Pointers

- Claude Code / Codex: `AGENTS.md` (this file)
- Cursor / Copilot: read `AGENTS.md` as the canonical repository policy when configured.

<!-- harness:verbatim — mandated block, exempt from the non-inferability filter. Do not trim or paraphrase. -->
## Maintenance

Update this file **only** when ALL of the following are true:

1. Information is not directly discoverable from code / config / manifests / docs
2. It is operationally significant — affects build, test, deploy, or runtime safety
3. It would likely cause mistakes if left undocumented
4. It is stable and not task-specific

**Never add:** architecture summaries, directory overviews, style conventions
already enforced by tooling, anything already visible in the repo, or
temporary / task-specific instructions.

Prefer modifying or removing outdated entries over appending. When unsure, add
a short inline `TODO:` comment rather than inventing guidance.

Size budget: target ≤100 lines, hard warn >200. Move long content to
`docs/*.md` (read on demand, cross-tool) and leave a pointer line here. On a
Claude-Code-only repo you may instead use `.claude/rules/*.md` (path-scoped,
auto-loads when the matching area is touched); on a multi-tool repo keep the
content in `docs/` so Codex/Cursor see it too.

**Memory boundary:** durable code/repo facts live here, in `.claude/rules/`, and
`docs/` — human-authored and version-controlled. Claude Code's auto-memory
(`MEMORY.md`) holds the model's discovered preferences and cross-session
learnings only; never promote a code fact into auto-memory, and don't hand-edit
`MEMORY.md`.
