# Accessible visual and motion polish audit

Full review of the home, runner, consequence dialog, progress feedback and Undo receipt. React 19 and the existing plain CSS remain the implementation conventions. The cream/forest palette and graph engine are preserved. Base: `6fd9b21dee9e2e1e4a7e9d37f0e3d4202a4ae2dc`, including independently reviewed PR #1.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Runner and narrow/reflow screenshots; `src/style.css:10` | Balanced headings, stable numeric counts, readable choice labels |
| Surfaces | Runner, dialog, 320px screenshots; `src/style.css:34` | Distinct consequence groups and persistent change receipt |
| Animations | `src/ui.tsx:16`; actual Chromium timing/interruption and reduced-motion tests | 180ms content, 260ms transform fills; no initial runner entrance, loops, bounce or state delays |
| Icons | Home, runner, dialog; `src/ui.tsx:10` | Deterministic currentColor SVG arrows/checks/Undo, hidden from accessible names |
| Performance | Animation code, production build | Transform/opacity only; cancellable effects, no new dependencies, animation timers, or will-change allocation |

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `src/App.tsx:40` | Fill included answered choices and excluded steps, beside an action-completion count | Only actions counted; separate complete, striped not-needed, empty remaining segments and numeric labels | Progress must describe actual completion; exclusion is never completion |
| MEDIUM | `src/App.tsx:67`, `src/ui.tsx:33` | Transient notices and an Undo button distant from the change | History-derived receipt beside progress, named change, reset/retained counts and Undo | Meaning survives reload; Undo identifies the exact latest remaining transition |
| MEDIUM | `src/App.tsx:75`, `src/style.css:41` | Reset and retained lists shared undifferentiated presentation | Named regions with text, SVG, borders and restrained tint | Consequences are easier to distinguish without depending on color |
| MEDIUM | `src/ui.tsx:6`, `src/App.tsx:75` | React autoFocus did not produce native autofocus for repeated showModal openings | Native autofocus attribute on each dialog's safe action | Initial focus stays on Cancel; native modality, Escape and focus restoration remain intact |
| MEDIUM | `src/style.css:18`, `src/style.css:51` | Some path buttons and summaries below 44px; Unknown wrapped at 320px | 44px targets, content-sized choice buttons, narrow receipt and dialog reflow | Touch and keyboard controls remain usable at narrow widths |
| LOW | `src/ui.tsx:10`, `src/App.tsx:52` | Font-dependent arrows, checks and return glyphs | One inline SVG set | Consistent icon geometry and optical weight |
| LOW | `src/ui.tsx:16`, `src/style.css:32` | Abrupt content and progress changes | Restrained cancellable feedback for real changes, immediate reduced-motion final states | Motion explains the action while retaining static meaning |
| LOW | `src/style.css:10`, `src/style.css:53` | Changing numerals and a single forced-color bar | Tabular counts, balanced headings and system-color solid/striped/empty segments | Stable text and equivalent meaning in forced colors |

Considered and rejected: ambient loops (attention cost and explicit scope); new animation dependencies (unnecessary for this pass); timed exit choreography (would complicate immediate state and native dialog behavior). Existing palette and layout structure remain the visual anchor.

## Verification

Windows, temporary Node 24.21.0 matching the repository's Node 24 CI family. No project dependency changes.

- `npm run typecheck`: passed.
- `npm test`: 52 unit/DOM tests passed. These are not browser verification.
- `npm run build`: passed.
- `npm run test:offline`: eight static generator/handler tests passed.
- `npm run test:contrast`: all 12 declared-palette pairs passed; this is a static palette check.
- `node node_modules/playwright/cli.js test --project=chromium --workers=2`: eight real Chromium tests passed after rebasing. Includes PR #1's actual service-worker control, offline reload, shell-only update and scoped-cache lifecycle check against the polished build.
- Runtime paths: complete the Yes branch; preview No with two resets/three retained; Cancel and Escape without mutation; focus returns to the triggering choice; repeat an identical answer without history/receipt drift; confirm No; verify IndexedDB through readonly reads before reload; restore receipt; Undo then reload; repeated Undo to empty history. Native modal Tab traversal and visible keyboard focus passed.
- Real Chromium: 320px home/runner/dialog reflow, 44px visible control heights, forced-colors states, doubled root text at 640 CSS pixels, and axe checks passed. Actual 180ms/260ms timings were read, effects slowed to 10%, interruption tested, and changing to reduced motion canceled in-flight effects. Reduced-motion interactions showed zero active animations with unchanged state meaning.

Limitations: Firefox was attempted by the full browser command but failed before any interaction with Windows `browserType.launch: spawn UNKNOWN`; Firefox behavior is not verified locally. Native 200% browser zoom is not exposed by this automation setup; doubled-text reflow is explicitly an approximation. No screen-reader or physical touch-device certification is claimed. Existing capture/video/source-hash files and pending Library/submission work are untouched.

No remaining actionable findings in the inspected Chromium scope. Independent review, Firefox execution on a working host and native browser zoom remain pending; keep the PR in draft and do not merge without independent review.
