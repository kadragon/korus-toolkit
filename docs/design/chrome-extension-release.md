# Chrome Extension Release Packaging and Store Distribution Policy

## Purpose and fixed boundaries

This document defines the release boundary for the KORUS Toolkit browser extension. It
applies to the repository's selected stack: Chrome and Microsoft Edge desktop on Chromium,
Manifest V3, TypeScript bundled by Vite, and pnpm with a committed lockfile.

The release boundary remains the exact KORUS origin, `https://knue.korus.ac.kr/*`. This
policy does not add product behavior, permissions, a packaging script, CI publishing, or
store-account automation. It does not assert current Chrome Web Store or Microsoft Edge
store requirements; the release owner must read the vendors' current official guidance
before each submission.

## Source of truth and reproducibility

- The release source revision is the exact Git commit selected for release. The committed
  dependency lockfile is part of that input and must be used unchanged.
- `public/manifest.json` is the source Manifest V3 file. Its version field is the release
  version source of truth. The generated `dist/manifest.json` and store metadata must match
  that value; neither may become an independent version source. If the source version cannot
  be read or the generated value differs, stop the release.
- The canonical release artifact is the unmodified `dist/` directory produced by `pnpm build`
  from that commit after `pnpm install`. `dist/` is generated output and is not committed.
- Reproducibility means identical source commit, lockfile, recorded build-tool versions,
  dependency installation, and build inputs, with no edits after the build. The repository
  records the stack and commands but does not pin tool versions or provide a verified archive
  command. The release record must therefore capture the actual tool versions and any archive
  tool used; this policy does not invent those values.
- If a vendor requires an upload archive, create it only from the validated `dist/` contents
  and only in the format required by the vendor's current guidance. The archive is a derived
  upload form, not a second source of truth. Do not include source files, dependencies,
  credentials, cookies, tokens, logs, or captured KORUS data.

## Build and package flow

Run the repository-verified commands in this order from the selected release commit:

1. `pnpm install`
2. `pnpm build`
3. `pnpm test`
4. `pnpm typecheck`
5. `pwsh -File tools/check-principles.ps1` whenever product files or a manifest exist.

The build output is the release candidate. Do not hand-edit `dist/manifest.json` or any
bundled file. Preserve the exact output used for validation when preparing a vendor upload;
if a vendor-specific archive is necessary, record that it was derived from this output and
record the current vendor requirement that required it.

## Unpacked-artifact validation

Before any store submission, validate the generated artifact as an unpacked extension:

- Inspect `dist/manifest.json` against `public/manifest.json`, including the source version,
  Manifest V3 declaration, exact KORUS origin, and only the permissions exercised by shipped
  code.
- Confirm the output contains no remote code and no sensitive or captured KORUS material.
- Load `dist/` unpacked in Chrome and in Microsoft Edge, as required by the repository runbook.
  Exercise only sanitized, non-credential-backed checks; never collect or retain live KORUS
  page content as a release artifact.
- Record the commit, source version, build inputs, commands completed, artifact location, and
  browser results. A failed, unavailable, or unexplained check blocks distribution.

## Chrome and Edge store distribution

Store distribution is manual, human-initiated, and reviewable.

- Treat Chrome and Edge as separate submission channels. Use the same validated `dist/`
  artifact for both only when each vendor's current requirements permit it. If a vendor needs
  a different upload form, derive it from the same validated output and record the difference.
- Before submission, the release owner reads the current official vendor requirements and
  records the requirements applied to this release. This policy intentionally leaves changing
  details such as account steps, listing fields, archive format, review process, and platform
  limits unspecified.
- A reviewer compares the proposed upload and listing metadata with the source commit,
  manifest version, permissions, and documented data handling before the release owner
  submits it. No automated upload, store API credential, or unattended publishing path is
  authorized by this repository policy.
- Do not publish when a vendor requirement, permission, privacy statement, or artifact
  difference is unclear. Resolve it through current vendor guidance and a new reviewable
  release record; do not patch the upload by hand or infer a platform rule.

## Release privacy and security gates

Every release must pass all of these gates:

- Host access remains exactly `https://knue.korus.ac.kr/*`; no additional origin is accepted.
- Every extension permission has an exercised shipped-code path and documented rationale.
  Broad or future-use permissions require explicit approval and are not release defaults.
- Credentials, cookies, tokens, session identifiers, authorization material, and institutional
  data never enter source, `dist/`, Git, logs, fixtures, telemetry, store packages, or release
  records.
- No captured KORUS pages, documents, account data, or live browser artifacts are included.
  Fixtures and checks use sanitized or synthetic data only.
- The package contains no remote code. External APIs and telemetry are not part of the selected
  release boundary.
- Any failure to establish one of these conditions blocks packaging or submission. Never use a
  live credential or captured institutional artifact to make a release check pass.

## Release record

Keep a reviewable record containing, at minimum: the exact Git commit; the version read from
`public/manifest.json`; the lockfile and recorded build-tool versions; the verified commands;
the validated `dist/` artifact and any derived upload form; the Chrome and Edge unpacked-load
results; the current vendor guidance applied; and reviewer approval. The record must contain
no credentials, cookies, tokens, or KORUS data.
