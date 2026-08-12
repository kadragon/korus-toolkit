# Conventions

## Unknowns

The stack is decided in `docs/design/chrome-extension-stack.md`, but language-specific naming and formatting rules stay absent until manifests and tooling make them discoverable. Do not invent TypeScript, Vite, pnpm, UI-framework, or test-framework conventions ahead of the scaffold; no UI framework is selected.

## Extension Safety

- Request only permissions exercised by shipped code.
- Restrict host access to `https://knue.korus.ac.kr/*` unless user explicitly approves another origin and documentation explains why.
- Treat DOM selectors as integration contracts: keep them centralized, name the page state they represent, and cover observed variants with fixtures that contain no real KORUS data.
- Never log or fixture credentials, cookies, authorization headers, session identifiers, or copied institutional data.
- Prefer text-safe DOM APIs. Any HTML injection requires sanitization and a focused security test.
- Do not automate destructive KORUS actions without an explicit confirmation step at point of action.

## Error Handling

- Fail closed when page shape or privilege assumptions do not match.
- Include actionable context without sensitive values.
- Never swallow an error that can leave a partially completed KORUS action.

## Git

- Branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `harness/<slug>`.
- Never commit to `main` or `master`.
- Commits: `[FEAT]`, `[REFACTOR]`, `[FIX]`, `[TEST]`, `[CONSTRAINT]`, `[DOCS]`, `[HARNESS]`, or `[PLAN]` followed by an English description.
- One logical change per commit; checks green.
