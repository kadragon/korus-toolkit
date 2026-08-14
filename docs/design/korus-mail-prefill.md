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
- Run the content script in all matching frames because the observed reply composer is loaded in the KORUS body frame; page-path validation still keeps unsupported frames inert.
- Insert with text-safe DOM operations. A new composer and a reply composer each receive at most one insertion for their own lifetime; repeated DOM observations must not duplicate the phrase. Reply insertion targets the editable response area before quoted content.
- When the phrase contains the exact `{{받는 사람}}` token, wait for the first `option[username]` in the unique `select#selectrcvuser` recipient list, replace every token with that option's username once, and then insert the resolved phrase. Later recipient changes do not rewrite the inserted text.
- Treat an empty phrase as disabled. If the expected page state or editable target is absent or ambiguous, do nothing and surface an actionable non-sensitive diagnostic where appropriate.

## Testing Decisions

- Add Vitest unit/integration coverage using sanitized DOM fixtures for the observed new-composer and reply-composer shapes, existing body or quoted text, repeated observation, empty phrase, special characters, line-break conversion, first-recipient placeholder replacement, delayed recipient readiness, and selector/page-state mismatch cases.
- Add extension smoke coverage for loading the built Manifest V3 extension and the settings/content-script lifecycle when the scaffold provides the corresponding scripts.
- Run `pnpm test`, `pnpm build`, and `pwsh -File tools/check-principles.ps1` once the scaffold defines these commands and product files exist. Keep live KORUS verification manual and credential-backed through the existing helper; do not commit captured page data.

## Observed Workflow Contract

Observed on 2026-08-14 through the existing credential-backed browser helper. The observation recorded page paths, accessible labels, and element attributes only; it did not retain credentials, recipients, subjects, body text, or other KORUS page data.

1. The authenticated landing page is at `/poc/mi/IndxCtr/indx.do` on the exact KORUS origin.
2. The landing page exposes an `업무관리` entry point. The resulting same-origin application shell contains a top frame at `/bms/top.do`.
3. The top frame exposes an `업무메일` navigation label. Its visible anchor uses `href="#"`; the adjacent `.over` control dispatches the observed `MGRP_WCM` menu action and loads `/bms/wcm/menu_wcm.do` into the left menu frame.
4. The mail menu exposes a `메일쓰기` entry. Its observed action opens `/bms/wcm/bizAddView.do` as a separate top-level same-origin compose page (popup).
5. An existing 업무메일 can be opened from the mail list. Its visible `답장` action opens `/bms/wcm/bizAnswerView.do` as a same-origin compose page in the existing body frame.
6. The reply page title is `메일쓰기`, and the page contains one visible `div.note-editable[contenteditable="true"]` body editor.
7. The observed reply editor begins with two `<br>` elements followed by existing paragraph blocks. No semantic quoted-content marker was observed; the integration treats all existing editor content as protected and prepends only to the validated editor.

The captured workflow covers both new mail and reply composition. Reply content is observed only as an in-page editor state; no message content is retained in repository artifacts.

## New Composer DOM Contract

The new composer is recognized only when all of the following are true:

- `location.origin` is `https://knue.korus.ac.kr`.
- `location.pathname` is `/bms/wcm/bizAddView.do`.
- A visible heading has the exact accessible text `메일쓰기`, or the observed visible `td.pupup_title` table-cell marker has that exact text.
- Exactly one visible `div.note-editable[contenteditable="true"]` exists for the editable body.

The observed composer context also contains exactly one visible `input#title[name="title"]` subject control and exactly one visible `input#txtUsername_test[name="txtUsername_test"]` recipient control. These controls are documented context markers, not recognition gates for a body-only integration.

When a saved phrase contains `{{받는 사람}}`, the integration additionally reads the first recipient from the unique `select#selectrcvuser` list and its `username` option attribute. The body prefill waits for that option when necessary; the recipient control itself is never changed.

The page also contains a hidden `input#editBoxVal[name="contents"]` and a visible `textarea#sign[name="sign"]`. Neither is the observed body target: the former is hidden state, and the latter's semantic relationship to the composer body was not established. A synthetic typing check did not immediately change the hidden mirror; the observed host send path copies the visible `#editBox` HTML into `#editBoxVal` before submission. Extension insertion therefore targets only the validated visible editor, never writes the hidden field directly, and does not claim to send or verify a message.

Integration code must fail closed when the origin, path, page marker, or any required target is absent or ambiguous. The new-mail prefill task authorizes only text-safe insertion into the validated visible `.note-editable` target; it does not authorize sending, recipient changes, hidden-field writes, or other KORUS actions.

## Reply Composer DOM Contract

The reply composer is recognized only when all of the following are true:

- `location.origin` is `https://knue.korus.ac.kr`.
- `location.pathname` is `/bms/wcm/bizAnswerView.do`.
- `document.title` has the exact text `메일쓰기`.
- Exactly one visible `div.note-editable[contenteditable="true"]` exists.

The observed editor contains existing response/quoted content after two leading `<br>` elements, but no stable semantic boundary identifies the quoted portion. The extension therefore inserts the configured phrase before the editor's first child and preserves every existing node. It never parses, rewrites, or stores the reply content.

Reply recipients are already populated in the observed workflow through the same `select#selectrcvuser` list. A phrase containing `{{받는 사람}}` uses the first `option[username]` value at insertion time and never rewrites the reply body when later options change.

Sanitized fixture shape for future tests:

```html
<h2>메일쓰기</h2>
<input id="title" name="title" type="text">
<input id="txtUsername_test" name="txtUsername_test" type="text" class="input">
<select id="selectrcvuser" name="selectrcvuser"></select>
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

- The smallest installable exact-origin extension and the new-composer and reply-composer workflow contracts are complete prerequisites for this feature.
- The new-composer and reply-composer selectors and page-state markers above are directly observed. The reply editor has no observed semantic quoted-content boundary, so insertion remains a prepend-only operation.
- The feature should remain usable when the saved phrase is changed or cleared without requiring KORUS data migration.
