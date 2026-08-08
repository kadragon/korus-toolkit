# Evaluation Criteria

The repository uses a Sprint Contract for planned work. Evaluation is evidence-first and must be performed by a fresh verification pass, the user, or a separate authorized agent—not by silently accepting the implementer's impression.

## Sprint Contract

Before implementation record exact scope, success criteria, exclusions, verification command or observable check, and permission/privacy impact. A failed checkbox fails the sprint.

## Rubric

| Criterion | Weight | 5 | 3 minimum | 1 |
|-----------|-------:|---|-----------|---|
| Functional correctness | 40% | All contract cases and observed variants pass | Happy path passes with no known regression | Core workflow fails or evidence missing |
| Safety and privacy | 30% | Least privilege and no sensitive-data exposure | No known leak; permissions have rationale | Broad permission, secret/data exposure, or unsafe action |
| KORUS integration resilience | 20% | Page states validated; mismatch fails closed | Observed target page works safely | Arbitrary DOM assumptions or silent corruption |
| Maintainability | 10% | Minimal boundaries, focused checks, docs match code | Understandable and verified | Unnecessary coupling or stale instructions |

Pass requires every criterion >=3, weighted average >=3.5, and every contract checkbox passing.

## Evidence Protocol

1. List pass/fail evidence before assigning scores.
2. Run only commands verified in `docs/runbook.md` or the selected stack's own manifest.
3. Inspect permissions and `tools/check-principles.ps1` output when product files exist.
4. For UI flows, distinguish a live KORUS check from a sanitized fixture.
5. Return `ship`, `revise`, or `reject`, plus the top three risks.
