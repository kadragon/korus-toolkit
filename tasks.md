# KORUS Playwright Login Helper

status: active

## Scope

- Add a reusable Playwright CLI wrapper for the exact KORUS origin.
- Read `KORUS_ID` and `KORUS_PW` from the local `.env` only.
- Leave the named browser session on the authenticated KORUS landing page.
- Keep credentials, cookies, and page data out of repository files and command output.

## Acceptance Criteria

- [ ] Missing `.env` keys fail with a non-sensitive error.
- [ ] Login fields use the observed accessible locators.
- [ ] Successful execution verifies the exact origin, landing path, and visible logout marker.
- [ ] Existing authenticated sessions skip credential entry and still verify the landing page.
- [ ] Syntax, principle checks, and a live credential-backed run pass.

## Evaluator Feedback

- Pending verification.
