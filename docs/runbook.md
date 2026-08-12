# Runbook

## Current State

Harness is Level 1. Product stack is decided in `docs/design/chrome-extension-stack.md`: Chrome and Edge, Manifest V3, TypeScript, Vite, pnpm. No scaffold, `package.json`, or manifest exists yet, so no install/build/test command is asserted until verified against the built scaffold.

## Harness Checks

| Operation | Verified method |
|-----------|-----------------|
| Product boundary check | `pwsh -File tools/check-principles.ps1` |
| Structural harness validation | Invoke the loaded `dev:harness-init` validator from its plugin `scripts/` directory |
| Claude pointer repair | Run the loaded plugin `scripts/sync-claude-md.sh` from the repository root |
| Skills link repair | Run the loaded plugin `scripts/symlink-guard.sh` from the repository root |

## Product Commands

| Operation | Verified command |
|-----------|------------------|
| Install dependencies | `[unknown — select stack and run command to verify]` |
| Build | `[unknown — select stack and run command to verify]` |
| Test | `[unknown — select stack and run command to verify]` |
| Lint/format | `[unknown — select stack and run command to verify]` |
| Package/load extension | `[unknown — select browser and manifest format, then verify]` |
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
