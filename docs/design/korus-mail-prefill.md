# KORUS Mail Prefill Phrase

## Problem Statement

KORUS 업무메일 신규 작성과 답변 작성에는 반복되는 인사말을 매번 직접 입력해야 한다. The extension has no product scaffold or DOM integration contract yet, so implementing the feature without first defining page states and trust boundaries would make the behavior fragile and difficult to verify.

## Solution

Add a Chromium extension feature that lets the operator save one prefill phrase in the extension settings. When a new 업무메일 composer or reply composer is opened on the KORUS 업무관리 mail flow, insert the configured phrase at the beginning of the operator's editable response area exactly once for that composer. Preserve existing user text and quoted mail content.

## User Stories

- As a KORUS operator, I want to save and edit one reusable phrase, so that I can keep my standard greeting consistent.
- As a KORUS operator, I want the phrase inserted into a new 업무메일, so that I can start writing immediately.
- As a KORUS operator, I want the phrase inserted into a reply without changing quoted mail, so that my response remains clear and correctly attributed.
- As a maintainer, I want page-state and selector mismatches to fail closed, so that a KORUS page change cannot silently alter unrelated content.

## Implementation Decisions

- Use the selected Chromium Manifest V3, TypeScript, Vite, and pnpm stack; keep extension lifecycle, KORUS integration, feature logic, and browser persistence behind their intended boundaries.
- Limit host access to `https://knue.korus.ac.kr/*`; add only the permissions required by the shipped path. No external origin or remote code.
- Provide one settings surface for one phrase and store only that phrase in extension-local storage. The value is user-controlled text; provide a clear/reset path and never store KORUS page content, credentials, cookies, tokens, or session identifiers.
- Centralize KORUS page detection, composer state, and selectors in an integration adapter. The adapter must distinguish a new composer from a reply composer and expose only a validated editable response area to feature logic.
- Insert with text-safe DOM operations. A new composer and a reply composer each receive at most one insertion for their own lifetime; repeated DOM observations must not duplicate the phrase. Reply insertion targets the editable response area before quoted content.
- Treat an empty phrase as disabled. If the expected page state or editable target is absent or ambiguous, do nothing and surface an actionable non-sensitive diagnostic where appropriate.

## Testing Decisions

- Add Vitest unit/integration coverage using sanitized DOM fixtures for new compose, reply compose, existing body text, quoted content, repeated observation, empty phrase, special characters, and selector/page-state mismatch cases.
- Add extension smoke coverage for loading the built Manifest V3 extension and the settings/content-script lifecycle when the scaffold provides the corresponding scripts.
- Run `pnpm test`, `pnpm build`, and `pwsh -File tools/check-principles.ps1` once the scaffold defines these commands and product files exist. Keep live KORUS verification manual and credential-backed through the existing helper; do not commit captured page data.

## Observed Workflow Contract

Observed on 2026-08-14 through the existing credential-backed browser helper. The observation recorded page paths, accessible labels, and element attributes only; it did not retain credentials, recipients, subjects, body text, or other KORUS page data.

1. The authenticated landing page is at `/poc/mi/IndxCtr/indx.do` on the exact KORUS origin.
2. The landing page exposes an `업무관리` entry point. The resulting same-origin application shell contains a top frame at `/bms/top.do`.
3. The top frame exposes an `업무메일` navigation label. Its visible anchor uses `href="#"`; the adjacent `.over` control dispatches the observed `MGRP_WCM` menu action and loads `/bms/wcm/menu_wcm.do` into the left menu frame.
4. The mail menu exposes a `메일쓰기` entry. Its observed action opens `/bms/wcm/bizAddView.do` as a separate same-origin compose page.

The captured workflow covers new mail composition only. Reply composition and quoted-content markers remain unobserved and must not be inferred from this contract.

## New Composer DOM Contract

The new composer is recognized only when all of the following are true:

- `location.origin` is `https://knue.korus.ac.kr`.
- `location.pathname` is `/bms/wcm/bizAddView.do`.
- A visible heading or table cell has the exact accessible text `메일쓰기`.
- Exactly one visible `input#title[name="title"]` exists for the subject field.
- Exactly one visible `input#txtUsername_test[name="txtUsername_test"]` exists for recipient entry.
- Exactly one visible `div.note-editable[contenteditable="true"]` exists for the editable body.

The page also contains a hidden `input#editBoxVal[name="contents"]` and a visible `textarea#sign[name="sign"]`. Neither is the observed body target: the former is hidden state, and the latter's semantic relationship to the composer body was not established.

Integration code must fail closed when the origin, path, page marker, or any required target is absent or ambiguous. Body operations, when later implemented, may address only the validated visible `.note-editable` target. This ticket does not authorize insertion, sending, recipient changes, or any other page mutation.

Sanitized fixture shape for future tests:

```html
<h2>메일쓰기</h2>
<input id="title" name="title" type="text">
<input id="txtUsername_test" name="txtUsername_test" type="text" class="input">
<div class="note-editable" contenteditable="true"></div>
<input id="editBoxVal" name="contents" type="hidden">
<textarea id="sign" name="sign"></textarea>
```

## Out of Scope

- Multiple phrases, phrase libraries, conditional templates, or automatic signature management.
- Subject-line changes, attachments, recipient changes, automatic sending, or other destructive KORUS actions.
- Authentication, credential handling, cookie access, session persistence, external APIs, telemetry, or origins outside KORUS.
- Persistence of KORUS content or user mail content.
- Store distribution, release packaging, and browser support beyond Chrome and Microsoft Edge desktop.

## Further Notes

- The existing backlog items for the smallest installable exact-origin extension and a sanitized observed KORUS workflow are prerequisites for this feature.
- The new-composer selectors and page-state markers above are directly observed. Reply-composer selectors, quoted-content boundaries, and any insertion behavior remain unknown; product code must not invent them.
- The feature should remain usable when the saved phrase is changed or cleared without requiring KORUS data migration.
