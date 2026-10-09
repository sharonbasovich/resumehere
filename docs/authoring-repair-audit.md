# Explicit repair of deleted references

Reproduced in the live GitHub Pages app before implementation: in the meetup editor, removing booking-code step 1 left Check-in with `Unknown prerequisite: code.` and disabled Preview, but no checkbox for clearing that edge. Removing the kit choice left invalid action conditions while their selects displayed “Always needed.” Cancel editing restored the running sample.

The fix keeps draft references and strict validation intact. Missing prerequisites appear as checked, named rows with removal/reassignment instructions. Unchecking explicitly removes that edge and transfers focus to an available prerequisite or condition control. Missing choice IDs remain the selected, disabled option; authors explicitly select a replacement or Always needed. Reassignment preserves the current Yes/No requirement. Known removed steps use their running-guide wording and ID; an unsaved step falls back to its ID. No automatic graph repair, engine, storage, schema, dependency or service-worker changes.

Full interface review of the repair fields only; React 19, existing plain CSS. The running UI and motion are outside this focused visual review, but their browser regression suites are retained.

| Category | Evidence | Result |
| --- | --- | --- |
| Typography | Desktop and 320px repair screenshots | Full missing reference name wraps outside narrow native selects; helper text fits |
| Surfaces | Repair block, checkbox label, native select | Existing cream/forest palette, amber structural border, 44px controls |
| Animations | Repair component and existing browser motion tests | No added motion or timers; repairs update immediately |
| Icons | Repair component | Native checkbox/select cues; no new decorative icons |
| Performance | Component and build | At most 16-node lookups, no effects, dependencies or timers |

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `src/App.tsx`, `src/ReferenceFields.tsx` | Deleted prerequisite absent from all repair controls | Checked missing row, explicit removal plus existing replacement checkboxes | A valid guide can be authored without recreating dependents |
| HIGH | `src/ReferenceFields.tsx` | Invalid condition visually appeared Always needed; changing choice defaulted requirement to Yes | Explicit missing selected option and descriptive invalid state; preserve required answer on reassignment | Display and changes describe actual dependency meaning |
| MEDIUM | `src/ReferenceFields.tsx`, `src/style.css` | Missing repair flow had no keyboard path or narrow presentation | Native controls, descriptive help, focus transfer after removal, wrapped missing name | Meaning and control remain available at 320px and by keyboard |

Rejected: silently clearing all references on deletion (changes dependency meaning), and a separate destructive-removal wizard (unnecessary beyond the existing strict editor/preview/confirmation flow). No extra animation was added to this correction.

## Verification

- Node 24.21.0. Typecheck and production build passed.
- 52 existing unit/DOM tests passed. Eight static offline tests and all 12 declared contrast pairs passed. These are static/DOM checks, not runtime verification.
- All 11 real Chromium cases passed against the isolated production preview on port 4174, including existing motion and service-worker lifecycle suites.
- New browser regressions use actual UI interactions and readonly IndexedDB snapshots. No progress or guide is injected. Draft deletion, repairs, preview, Escape, dialog Cancel and Cancel editing leave the saved running snapshot exactly unchanged.
- Deleted action repair resets four completed actions in its old/new affected closure, retains the independent notebook, preserves the kit answer, survives reload and then Undo restores the full original guide, source bindings, answers, completions and history exactly, also after reload.
- Deleted choice repair explicitly clears one condition and reassigns another while preserving No. Confirmation resets its two completed descendants, retains three independent completions, removes the old answer and survives reload. Undo restores the exact original snapshot and reload.
- Desktop and 320px native keyboard repair paths have visible 3px focus outlines. Native select operation, at least 44px control heights, no horizontal overflow, forced colors, reduced motion and runtime axe checks passed. Screenshots were inspected visually.
- Local Firefox was attempted with the complete suite, stopping after its first launch failure: Windows `browserType.launch: spawn UNKNOWN`, before any interaction. Linux CI must supply Firefox coverage; the PR description and checks record its final result.

No actionable findings remain in the inspected Chromium repair flow. Native browser zoom, screen-reader/physical-device certification and local Firefox execution are not claimed. Independent review is required before merging. Capture/video, Library and submission work are untouched.
