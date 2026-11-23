# KORUS training certificate autofill

The training dialog title explains that uploaded PDFs are analyzed automatically.
The extension waits for a successful upload before reading the selected PDF locally.
The result panel appears after the file dialog is dismissed. It fills empty dates, durations, and explicitly
labeled training content. One explicit duration defaults both time fields, while distinct
actual and recognized durations are kept separate. It shows the extracted
course and institution alongside copy buttons, direct course entry, and institution lookup.
The panel also offers one-click choices for learning method, domestic or foreign training,
and internal or external training. Each choice updates only its own field and shows the
last confirmed selection. The choices are available after closing the native dialog,
including when certificate parsing fails.
The user still controls attachment upload, dialog dismissal, and saving the application.

The isolated script accepts selections only after the attachment magnifier on the active
training form opens its file dialog. PDF.js and its parser are packaged in the extension.
The extension uses embedded text, does not render pages or use OCR, and never sends the
PDF or its raw text to a service. The institution lookup sends its search term through
KORUS only when the user starts it. The extension stores no document
data beyond the current draft and requests no new browser permissions.

A separate MAIN world script validates a narrow field protocol and updates the current
Nexacro controls through their native setters. The institution lookup requires fresh search
results and a unique exact match. Course entry uses the exact 기타교육과정 row and its native
direct input, and sends no course search. Automatic filling preserves existing values.
An explicit classification click can replace an existing selection.
Local tests use synthetic document and DOM data. Credential-backed browser
verification is performed separately by the operator.
