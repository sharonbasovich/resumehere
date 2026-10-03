# Verification record

Reference execution: 2026-10-03, Linux container, Node 24.19.0. The shell clock was four hours behind the task UTC clock; Vitest's printed wall-clock start time is not used as a UTC timestamp.

## Actually run

- TypeScript build/typecheck: passed.
- Vite production build: passed; static dist generated with relative paths.
- Vitest engine suite: 39 tests. Includes 64 generated bounded DAGs × 5 event sequences in one property-style test; this is one test case, not 320 independent tests.
- React/jsdom integration suite: 13 tests. Storage functions are mocked in these UI tests; real IndexedDB and native dialogs are not thereby verified.
- Axe structural rules on home, runner and editor in jsdom: no violations in the tested states. Color contrast explicitly disabled because jsdom has no layout engine.
- Independent read-only graph review: reported 1,920 assertions across 32 generated two-decision DAGs, independently derived invalidation, undo/edit/restoration checks. Independent reviewer reproduced and then verified fixes for undefined optional-field canonicalization and oversized snapshot rejection.
- Final aggregate: 52/52 tests passed in 2 files (6.79 seconds on the final recorded run). No test is claimed as a browser pass.
- Static declared-palette check: 12 foreground/background pairs pass 4.5:1 (minimum 5.08:1). This is a CSS palette calculation, not measured browser rendering or a full contrast audit.

## Browser blocker and pending checks

The initial CUA cloud-browser attempt to open the local development server returned `net::ERR_BLOCKED_BY_CLIENT`. No alternative browser automation or blocked-host workaround was used. Four Playwright runs (two flows in each of Chromium and Firefox) are now configured as a mandatory remote CI gate before Pages deployment, including actual IndexedDB reload and axe. They were not executed locally or remotely at this record’s creation. Defining CI is not a browser pass. No actual UI screenshots have been captured. A normal authorized public deployment is needed for CUA checks here.

Pending: Chromium and Firefox cold-start/reload/close-reopen; actual IndexedDB transaction persistence; offline cache startup; clean network capture; keyboard-only source selection, authoring, dialogs, focus and branch correction; screen-reader announcement quality; 200% zoom; 320 CSS-pixel reflow; measured contrast; reduced-motion preference; actual deployment access and media. Do not describe the app as accessibility-certified, fully browser-tested or submission-ready.

## Acceptance matrix

| ID | Scope | Current evidence |
|---|---|---|
| T01 | Blank authoring through finish | jsdom actions and preview/run pass; choice editor and keyboard browser flow pending |
| T02 | Exact source wording/repeated offsets | Engine binding tests and jsdom second-occurrence selection pass |
| T03 | Yes/no/unknown | Engine plus UI explicit-unknown/choice tests pass |
| T04 | Fork/rejoin | Engine both branches/generated graphs pass |
| T05 | Branch rollback | Engine and full UI sample reset 2/retain 3 pass |
| T06 | Uncheck/full undo | Engine closures/full frames; UI branch undo pass |
| T07 | Source/node edit invalidation | Engine source/edit/union tests pass; actual browser authoring pending |
| T08 | Invalid graph | Engine invalid forms pass; UI field error and disabled preview pass |
| T09 | Persistence/recovery | Engine strict JSON replay; UI mocked-storage reload/corruption pass. Real IndexedDB pending |
| T10 | Completion distinction | Engine and UI finished/not-needed scope pass |
| T11 | Accessibility | Semantic markup and jsdom axe subset; manual browser scope pending |
| T12 | Privacy/security | Text inertness tests and static no-egress review; real network capture/clear pending |
| T13 | Cold start/browsers/mobile | Not run; requires authorized deployment |
| T14 | Proof isolation | Original synthetic fixtures and source/license audit; final history/media audit pending publication |
| T15 | Generated graph sequences | 64 DAGs × 5 sequences in authored property test; independent review separate |

## Reviewer-found fixes

1. P1: Explicit `source: undefined` from ordinary authoring had differed from JSON-restored identity. Canonicalization now agrees with JSON and regression tests cover it.
2. P2: Large source/history could serialize past restoration limits. Serialize and restore now share caps; accepted UI transitions preflight serialization. The previous state remains unchanged if a candidate is too large. History is never silently pruned.
