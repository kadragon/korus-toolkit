# Chrome Extension Stack

## Problem Statement

The repository has a KORUS product boundary but no agreed runtime, browser targets, manifest version, package manager, or test strategy. Implementing the extension before resolving those choices would make the source layout, permissions, and verification contract unstable.

## Solution

Build a Chromium browser extension for Chrome and Microsoft Edge with Manifest V3, Vite, and TypeScript. Use pnpm for dependency management. Keep the first product scaffold small, loadable as an unpacked extension, restricted to the exact KORUS origin, and structured around explicit extension, KORUS integration, feature, and browser-platform boundaries.

## User Stories

- As a maintainer, I want one reproducible Vite/TypeScript toolchain for Chrome and Edge, so that feature work does not need browser-specific build paths.
- As a maintainer, I want typed KORUS observations and centralized DOM contracts, so that page-shape changes fail closed instead of corrupting actions.
- As a reviewer, I want permission and test decisions recorded before product code lands, so that security and regression checks remain inspectable.

## Implementation Decisions

- **Browsers:** Chrome and Microsoft Edge desktop, using their Chromium extension platforms.
- **Manifest:** Manifest V3. Background work, if needed, uses a service worker; no remote code.
- **Language and build:** TypeScript compiled and bundled by Vite. No UI framework selected until a feature requires one.
- **Package manager:** pnpm with a committed lockfile. The local shell must expose pnpm before dependency installation and verification.
- **Entry boundaries:** Extension entry points coordinate lifecycle only. KORUS selectors, page detection, and DOM operations stay in integration adapters. Feature logic consumes validated observations. Browser APIs stay behind platform adapters where practical.
- **Origin and permissions:** Host access is limited to `https://knue.korus.ac.kr/*`. Add only permissions exercised by shipped code; do not add broad permissions for future use.
- **Data handling:** Process KORUS content in memory by default. No credentials, cookies, tokens, session identifiers, or institutional data in source, fixtures, logs, telemetry, or committed artifacts.
- **Persistence:** No persistence in the base. Any later persistence requires a named purpose, minimal fields, retention rule, and deletion path.

## Testing Decisions

- **Unit and integration logic:** Vitest for TypeScript feature logic and sanitized DOM fixtures. Selectors and page-state contracts receive explicit mismatch tests.
- **Extension smoke:** Playwright against the bundled Chromium runtime for loading the built Manifest V3 extension and checking the minimal lifecycle. Chrome and Edge manual load checks cover browser-specific packaging behavior.
- **Safety check:** Run `pwsh -File tools/check-principles.ps1` whenever product files or a manifest exist.
- **KORUS verification:** Live credential-backed checks remain explicit manual checks through the existing helper; credentials and captured page data never enter CI or fixtures.
- **Verified commands:** `pnpm install`, `pnpm build`, `pnpm test`, and `pnpm typecheck` are defined by the scaffold; the exact-origin manifest and generated content script are checked by `tools/check-principles.ps1` and the scaffold verification.

## Out of Scope

- KORUS workflow automation, selectors, or page-specific behavior before a sanitized observed-page contract exists.
- Authentication, credential storage, cookie handling, or persistence.
- External APIs, telemetry, remote code, or host access outside the exact KORUS origin.
- Store listing, release packaging, and distribution policy.
- Choosing a UI framework or adding product features.

## Further Notes

- The smallest installable exact-origin scaffold now exists; the next implementation slice is the observed KORUS workflow contract.
- `pnpm` is available in the implementation shell; verified commands and remaining manual browser checks live in `docs/runbook.md`.
- Minimum browser versions remain unspecified until the scaffold uses APIs that require them.
