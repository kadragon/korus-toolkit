# KORUS Playwright Login Helper

status: complete

## Scope

- Add a reusable Playwright CLI wrapper for the exact KORUS origin.
- Read `KORUS_ID` and `KORUS_PW` from the local `.env` only.
- Leave the named browser session on the authenticated KORUS landing page.
- Keep credentials, cookies, and page data out of repository files and command output.

## Acceptance Criteria

- [x] Missing `.env` keys fail with a non-sensitive error.
- [x] Login fields use the observed accessible locators.
- [x] Successful execution verifies the exact origin, landing path, and visible logout marker.
- [x] Existing authenticated sessions skip credential entry and still verify the landing page.
- [x] Syntax, principle checks, and a live credential-backed run pass.

## Evaluator Feedback

- PowerShell parser: PASS.
- `tools/check-principles.ps1`: PASS.
- Live fresh-session login and existing-session verification: PASS; landing path `/poc/mi/IndxCtr/indx.do`.
- Independent product evaluator unavailable in this session; evidence is mechanical plus live browser verification.
