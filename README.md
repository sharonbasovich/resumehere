# ResumeHere

**Follow branching instructions. Recover your place. Keep the progress that still counts.**

An original, deterministic prototype with no AI runtime for HackNowa 2026’s **Inclusive Technology** theme. A small, explicitly authored dependency graph turns a low-stakes procedure into explicit actions and yes/no choices. Correcting a choice previews exactly which completed steps need redoing and which independent steps remain complete. Undo restores the entire prior state.

## Run

Node.js 24 and npm are the reference toolchain. Versions are pinned in package-lock.json.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
```

For development: `npm run dev -- --host 127.0.0.1`. The explicit host avoids interface-enumeration restrictions in some containers. Build output is a static `dist/` directory, with relative asset paths for a GitHub Pages project site. No server, account, API key, model, or paid dependency is required by the product. The production service worker caches the shell for repeat offline use after a successful first load; browser offline behavior still requires real-browser verification.

## Try it

1. Choose **Try the meetup guide**. The story and booking code are fictional.
2. Answer **Yes** to the reserved-kit question, and confirm the preview.
3. Mark the booking-code, notebook, check-in, reserved-kit and table actions complete.
4. Change the kit answer to **No**. The preview resets two completed actions and retains three, including the independent notebook step.
5. Confirm. The activity sheet becomes ready; the reserved-kit step is **Not needed**, not complete.
6. **Undo last transition** restores the whole earlier guide and session. A fresh change back to Yes does not resurrect stale checks.
7. Reload to restore saved progress. **Edit instructions** supports source-bound text, explicit prerequisites, and condition gates. Whole-document changes conservatively reset all progress and choices.

Use **Clear saved guide** and confirm to remove only ResumeHere’s saved workspace. Or return Home and confirm **Start fresh** to replace it with a sample/new guide. The second original sample is a neighborhood book swap. Draft editor changes are not saved until previewed and run; cancelling leaves the last running guide intact.

## What is implemented

- Complete manual authoring, preview and execution from a blank guide
- Literal source passage selection with exact character offsets, including repeated text
- Up to 12 actions and 4 independent binary decisions; action dependencies may fork/rejoin
- Unknown choices remain unresolved; inactive branches are distinct from completion
- Union-graph dependency invalidation after answer, instruction, binding or prerequisite changes
- Reset/retained-work previews, explanations, and full-state undo
- Last still-valid completed action, all available actions, and whole-path context
- Version-bound IndexedDB session, event history and strict restoration by replay
- Consistent 5,000,000-character snapshot / 5,000-event limits; oversized candidates are rejected before replacing the current state. No silent history pruning
- Browser-native buttons, labels, fieldsets, dialogs, focus styles, live status, responsive layout and reduced-motion support
- Local-only application data, text-safe rendering, and a restrictive content-security policy

## Semantics

Guide definitions and execution sessions are separate. Status is computed from guide structure, explicit answers and accepted completion events. A node is unresolved, inactive-by-choice, waiting for prerequisites, ready, or complete. A prerequisite may be complete or explicitly inactive; unknown never equals inactive. All independent decisions must be answered before a guide is finished. Decisions cannot depend on or be gated by other decisions in this prototype; ambiguous nested-decision semantics are deliberately excluded.

Changing a choice resets its descendant completion closure. Editing uses the union of old and new graphs. Unchecking an action resets that action and descendants. Outside-closure completions survive. A whole source-document change has no safe inferred mapping, so creates a new version and resets everything. Undo restores the entire previous guide/answers/completions, rather than combining old and new versions. Source-bound instructions must exactly equal their referenced passage. Text is never interpreted or rewritten.

The guide identity is exact canonical structural text, not a cryptographic security hash. JSON normalization omits undefined object properties and normalizes array slots. Restore replays accepted events and compares the complete resulting snapshot; inconsistent or oversized data gets an explicit recovery message rather than fabricated completion.

## Verification and limits

See [the exact acceptance status](docs/verification.md). Automated engine and jsdom interaction tests are distinct from real browser testing. The Playwright suite is provided under `tests/` but was not run in the initial restricted execution environment. Axe structural checks in jsdom exclude color contrast and do not replace manual keyboard/screen-reader evaluation.

Known limits: one guide at a time, one browser profile, no sync or export/import, English user-authored instructions, independent binary decisions only, no automatic parsing, no personal outcome study, no accessibility certification. Browser storage can be denied, evicted or cleared. Draft changes are not durable before Run. Do not use for medical, legal, financial, emergency or other high-stakes procedures. Long repeated histories are bounded to protect honest recovery; a rejected change leaves the prior state intact.

## Privacy

No analytics, remote fonts, telemetry, external API or model calls. Source, answers and progress are stored in IndexedDB in the current origin and browser profile. They are **not encrypted**. Anyone using that profile may see them. The host still receives ordinary static page/asset requests; the application does not transmit instruction contents. Clear only targets the ResumeHere workspace record. A clean real-browser network observation is still pending; these are implementation properties, not a claim that such a capture was already performed.

## Why this problem

W3C’s [clear steps guidance](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/) discusses recognizing one’s place after distraction. It motivates this design; it does not establish that this app reduces cognitive load or improves outcomes. Supplemental guidance is not certification. No diagnoses or sensitive profiles are collected.

## No AI runtime

A separate pre-build FLAN-T5-small feasibility spike used 12 original synthetic cases and two prompts. Quality failed: outputs copied or changed meaning, including reversing an entrance restriction and inventing a discount. Reported cold Node startup was 22.7 seconds. That experiment was rejected. It is not part of this app, the passing test count, or a benefit claim. The released direction is deliberately deterministic and non-AI.

## Originality and licenses

Application source, state engine, tests, fictional samples and CSS illustration were newly created for this entry. No other campaign application code, screenshots, branding or fixtures were reused. Dependency graphs and checklists are established techniques; the claim is this original implementation and interaction combination, not exclusive invention of either concept.

The code, tests, documentation and original synthetic samples were created with AI assistance under the project owner’s direction. This describes the development process; the running application does not call an AI model. No human usability study or target-user evaluation has been conducted.

Original code: [MIT](LICENSE). Open-source dependency versions, declared licenses and repositories: [dependency provenance](docs/dependency-provenance.json). Available bundled notices are retained in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). There are no stock photos, generated images, model logos, remote icon kits, or external fonts. The landing illustration is CSS/text, not evidence footage.

The prepared GitHub Actions workflow runs typecheck, 52 unit/DOM tests, build, static palette checks and four Playwright runs (two flows each in Chromium and Firefox), then publishes Pages only after those checks. The browser server is started by Playwright and readiness is checked. Failure traces/screenshots are retained for seven days. Browser CI has not run yet; defining a gate is not evidence that it passed. Repository publication, deployed browser proof, demo filming and contest submission are separate gates; their existence must be verified before claiming completion.
