# Architecture

## Known Scope

- Product: browser extension for KORUS.
- Allowed web origin: `https://knue.korus.ac.kr/`.
- Runtime, supported browsers, Manifest version, language, build system, and test framework: undecided.

Do not convert common extension defaults into repository facts. Resolve the first backlog item before adding a manifest or source tree.

## Intended Boundaries

Once stack is selected, keep these conceptual boundaries explicit:

```text
extension entry points -> KORUS integration adapters -> feature logic
                       -> browser-platform adapters -> persistence
```

- Entry points coordinate browser lifecycle only.
- KORUS selectors, page detection, and DOM operations stay behind integration adapters.
- Feature logic consumes typed/validated observations rather than arbitrary page DOM.
- Browser APIs stay behind platform adapters where practical, enabling deterministic tests.
- No extension code sends KORUS content to an external origin unless a later, explicit design decision adds and documents that origin.

## Source Layout

No source layout exists. Record verified paths here after the stack decision and first scaffold.

## Data and Trust Boundaries

- KORUS page content is untrusted input; validate shape before use.
- Credentials, session identifiers, cookies, employee/student data, and document content are sensitive.
- Prefer in-memory processing. Persistence requires a named purpose, minimal fields, retention rule, and deletion path.
- Browser permissions and host permissions are security boundaries, not convenience flags.

## Architecture Decision Rule

Any stack or boundary decision goes into `docs/design/` first when it affects three or more files. Update this document only after implementation makes the decision observable.
