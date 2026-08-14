# Architecture

## Known Scope

- Product: browser extension for KORUS.
- Allowed web origin: `https://knue.korus.ac.kr/`.
- Supported browsers, Manifest version, language, build system, and package manager: decided in `docs/design/chrome-extension-stack.md` (Chrome and Edge, Manifest V3, TypeScript, Vite, pnpm). Test framework intent is recorded there and stays unverified until the scaffold lands.

Do not convert common extension defaults into repository facts. Record verified runtime details here only after the scaffold makes them observable.

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

- `public/manifest.json` is the source Manifest V3 file copied into the build output.
- `public/settings.html` is the extension-local options page copied into the build output.
- `src/extension/content-script.ts` is the content-script entry point; it remains a no-op until an observed KORUS page contract exists.
- `src/extension/settings.ts` coordinates the options-page lifecycle; `settings-controller.ts` owns view-independent settings actions, and `settings-store.ts` owns the browser storage adapter.
- `src/extension/*.test.ts` contains sanitized extension-boundary tests.
- `vite.config.ts` defines the content-script build entry and output name.
- `dist/` is generated unpacked-extension output and is not committed.

## Data and Trust Boundaries

- KORUS page content is untrusted input; validate shape before use.
- Credentials, session identifiers, cookies, employee/student data, and document content are sensitive.
- Prefer in-memory processing. Persistence requires a named purpose, minimal fields, retention rule, and deletion path.
- The settings page persists only the operator's one prefill phrase through extension-local storage; an empty phrase disables later insertion, and KORUS page content is not stored.
- Browser permissions and host permissions are security boundaries, not convenience flags.

## Architecture Decision Rule

Any stack or boundary decision goes into `docs/design/` first when it affects three or more files. Update this document only after implementation makes the decision observable.
