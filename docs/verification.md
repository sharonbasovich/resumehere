# Verification record

Reference execution: 2026-10-03, Linux container, Node 24.19.0. The shell clock was four hours behind the task UTC clock; Vitest's printed wall-clock start time is not used as a UTC timestamp.

## Initial local verification

- TypeScript build/typecheck: passed.
- Vite production build: passed; static dist generated with relative paths.
- Vitest engine suite: 39 tests. Includes 64 generated bounded DAGs × 5 event sequences in one property-style test; this is one test case, not 320 independent tests.
- React/jsdom integration suite: 13 tests. Storage functions are mocked in these UI tests; real IndexedDB and native dialogs are not thereby verified.
- Axe structural rules on home, runner and editor in jsdom: no violations in the tested states. Color contrast explicitly disabled because jsdom has no layout engine.
- Independent read-only graph review: reported 1,920 assertions across 32 generated two-decision DAGs, independently derived invalidation, undo/edit/restoration checks. Independent reviewer reproduced and then verified fixes for undefined optional-field canonicalization and oversized snapshot rejection.
- Final aggregate: 52/52 tests passed in 2 files (6.79 seconds on the final recorded run). These 52 tests are unit/DOM checks, separate from the browser evidence below.
- Static declared-palette check: 12 foreground/background pairs pass 4.5:1 (minimum 5.08:1). This is a CSS palette calculation, not measured browser rendering or a full contrast audit.

## Remote CI and public deployment verified

On 2026-10-03, [CI run 37145785149](https://github.com/sharonbasovich/resumehere/actions/runs/37145785149) passed for [commit 306f01a8213ec9c20d4a5127f3dcdf7bf42fc1c0](https://github.com/sharonbasovich/resumehere/commit/306f01a8213ec9c20d4a5127f3dcdf7bf42fc1c0), using Node 24.21.0 on Ubuntu 24.04.5. Typecheck, all 52 unit/DOM tests, production build, eight offline-worker harness tests, and all 12 declared-palette checks passed. All six Playwright cases passed (three each in Chromium and Firefox):

- Exact saved-status selector rejects pending, failed, stale and non-header text.
- Fictional sample completion, read-only IndexedDB assertion of five completed actions and the kit answer, reload restoration, branch reset-two/retain-three, axe in the tested runner state, and full undo.
- Blank guide authoring with inert script-like text, 320 CSS-pixel horizontal reflow, and axe in the tested state.

The Pages deploy job succeeded at 18:52:53 UTC. At 18:54–18:55 UTC, the [live public QA preview](https://sharonbasovich.github.io/resumehere/) was checked through the cloud browser's actual UI: landing page, fictional meetup sample, five completions, saved status, reload restoration, Yes→No preview resetting two and retaining three, confirmation with three of six actions complete, and undo restoring the finished five-action path. A landing screenshot was visually inspected; no demo video or screenshot package was produced.

The earlier CI failure was an exact-text selector mismatch caused by the decorative status icon. The reviewed test correction exact-matches the full header status, adds negative fixtures and independently polls the persisted snapshot; it retains the later reload, rollback, axe and undo checks. Production application code was unchanged by that test correction.

## Remaining limits

The initial local CUA attempt returned `net::ERR_BLOCKED_BY_CLIENT`; it was not a browser pass. Remote CI and the live checks above now provide bounded browser evidence, not comprehensive usability or accessibility validation.

Pending: browser close/reopen; comprehensive real-browser offline startup/update lifecycle (the eight offline tests are a harness); clean network capture; keyboard-only source selection, authoring, dialogs, focus and branch correction; screen-reader announcement quality; 200% zoom; measured contrast across all states; reduced-motion preference; real-browser clear/recovery failures; demo media and contest submission. No broad user study has been conducted. Do not describe the app as accessibility-certified, fully browser-tested or submission-ready.

## Acceptance matrix

| ID | Scope | Current evidence |
|---|---|---|
| T01 | Blank authoring through finish | jsdom actions and preview/run pass; blank guide preview/run passes in both browsers; choice-editor/keyboard flow pending |
| T02 | Exact source wording/repeated offsets | Engine binding tests and jsdom second-occurrence selection pass |
| T03 | Yes/no/unknown | Engine plus UI explicit-unknown/choice tests pass |
| T04 | Fork/rejoin | Engine both branches/generated graphs pass |
| T05 | Branch rollback | Engine, jsdom, both-browser CI and live sample reset 2/retain 3 pass |
| T06 | Uncheck/full undo | Engine closures/full frames; jsdom, both-browser CI and live branch undo pass |
| T07 | Source/node edit invalidation | Engine source/edit/union tests pass; existing-guide browser edit invalidation pending |
| T08 | Invalid graph | Engine invalid forms pass; UI field error and disabled preview pass |
| T09 | Persistence/recovery | Engine strict JSON replay; mocked-storage corruption checks; real IndexedDB snapshot and reload pass in both browsers; live reload also passes |
| T10 | Completion distinction | Engine and UI finished/not-needed scope pass |
| T11 | Accessibility | Semantic markup, jsdom axe subset and axe in two CI browser states; manual assistive-technology/keyboard scope pending |
| T12 | Privacy/security | Text inertness in both browsers and static no-egress review; real network capture/clear pending |
| T13 | Cold start/browsers/mobile | Chromium/Firefox CI load/reload and 320px reflow pass; public deployment loads; close/reopen and broader mobile coverage pending |
| T14 | Proof isolation | Original synthetic fixtures and source/license audit; published files verified against approved blobs; media audit pending |
| T15 | Generated graph sequences | 64 DAGs × 5 sequences in authored property test; independent review separate |

## Reviewer-found fixes

1. P1: Explicit `source: undefined` from ordinary authoring had differed from JSON-restored identity. Canonicalization now agrees with JSON and regression tests cover it.
2. P2: Large source/history could serialize past restoration limits. Serialize and restore now share caps; accepted UI transitions preflight serialization. The previous state remains unchanged if a candidate is too large. History is never silently pruned.
