# Runbook

## Current State

Harness is Level 1. Product stack is decided in `docs/design/chrome-extension-stack.md`: Chrome and Edge, Manifest V3, TypeScript, Vite, pnpm. The minimal exact-origin scaffold now builds an unpacked-extension artifact; KORUS workflow behavior remains deferred until an observed page contract exists.

## Harness Checks

| Operation | Verified method |
|-----------|-----------------|
| Product boundary check | `pwsh -File tools/check-principles.ps1` |
| Structural harness validation | Invoke the loaded `dev:harness-init` validator from its plugin `scripts/` directory |
| Claude pointer repair | Run the loaded plugin `scripts/sync-claude-md.sh` from the repository root |
| Skills link repair | Run the loaded plugin `scripts/symlink-guard.sh` from the repository root |
| Task-review on Windows | Use native Windows Git and GitHub CLI for commit/push/PR when WSL Bash cannot resolve `jq`/`node` or stages CRLF-only changes |

## Product Commands

| Operation | Verified command |
|-----------|------------------|
| Install dependencies | `pnpm install` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Typecheck | `pnpm typecheck` |
| Lint/format | `[unknown — select stack and run command to verify]` |
| Package/load extension | `pnpm build`; validate `dist/manifest.json` and load `dist/` unpacked in Chrome or Edge |
| KORUS login helper | `pwsh -File tools/korus-login.ps1` |

The KORUS login helper reads `KORUS_ID` and `KORUS_PW` from the local `.env`, opens a named `korus-dev` Playwright session, and leaves it on the authenticated landing page. Use `-Headed` when visual inspection is useful. Credentials and CLI command output are not printed.

## Sensitive Data

Never commit credentials, cookies, tokens, session identifiers, or captured institutional data. Use synthetic fixtures only. `.env` and `.env.*` are denied by `.claude/settings.json` and ignored by Git.

## Sweep Policy

Sweep is intentionally deferred. Install it after the first confirmed drift signal or model-upgrade assessment, then choose and document a manual, SessionStart, or CI trigger here.

## Common Failures

### Unsupported page state

Fail closed with a non-sensitive diagnostic. Do not guess selectors, fields, or workflow success.

### Broader host permission requested

Stop. Remove it or obtain explicit approval, document the exercised path, and update `tools/check-principles.ps1` with the policy change.
