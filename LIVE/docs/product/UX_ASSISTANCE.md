# Surgical UX assistance â€” verified checkpoint

Working repository: `E:\Golden State TIRTA - WORKING COPY`. Base: `00add65`. Safety checkpoint: `c12269d`. This report belongs to the implementation commit that contains it. The approved Golden experience is retained unchanged and is now the canonical production UI.

Preview: http://127.0.0.1:4273/production.html

## Delivered

- One coefficient-guidance source serves Studio and its contextual data dialog. Five surface classes have contextual references or an explicit absence of a universal range. Numeric low/mid/high choices require a click and subsequent application; value, reference and assumption are stored through existing USER_INPUT provenance. Custom values in 0â€“1 remain usable outside guidance with a source. Surface classification and photos never assign C.
- Central deterministic readiness reuses production schema, parameter resolution, baseline and optimizer preflight. Forward dependencies are gated with actionable missing-data rows, selected-zone recovery, revealed controls and focus. Backwards navigation stays available. Empty intervention selection remains explicit; no intervention is enabled automatically. Selected decisions still require current fingerprints.
- Local photo processing retains masks and actual pixel evidence and adds versioned brightness, saturation, edge density, local variation and repetition observations. Five cautious hypotheses expose reasons and ambiguity. Advice uses only known model/rainfall/baseline context; classification still requires confirmation, correction or rejection.
- Preventive dimensions, units, examples, source guidance and land-use warnings keep inputs editable. Blank rainfall remains UNKNOWN, distinct from explicit zero. Brief in-flow notices do not cover primary controls; validation remains inline.

## Verification

| Check | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | 118 tests, 15 files, PASS |
| `npm run build` | PASS |
| `TIRTA_RESCUE_URL=http://127.0.0.1:4273 npx playwright test -c playwright.production.config.ts` | 11 journeys, no skips, PASS; final run 44.4 s |
| `node scripts/review-ux-assistance.js` | 32 states; zero recorded axe violations, page overflow, console/page errors |
| `git diff --check` | PASS |

The browser suite extends the original six journeys. It covers a real empty project; 150 mÂ² calibration and >200 rejection; polygons, drag, vertex editing, invalid geometry and undo; actual image upload and human override; source-backed coefficients; two rainfall scenarios; 0/2/16 option spaces; infeasibility; reuse partition; Pareto alternatives; selected-plan reload/staleness; backup/import; revision conflict; offline service-worker reload/calculation; and touch authoring. Five additional journeys cover guidance, multi-zone readiness, notices/preventive inputs, richer photo observations/context, keyboard entry and reduced motion.

Import creates a new project identity. Its selected plan is therefore reviewed again before showing a current decision; the test verifies re-selection and unchanged accounting instead of bypassing the stale guard.

## Evidence

- [Screenshot gallery](.design/ux-assistance/index.html): 43 original captures, plus eight review contact sheets.
- [Actual visual review and support inventory](.design/ux-assistance/DESIGN_REVIEW.md).
- [32-state machine-readable matrix](.design/ux-assistance/runtime-review.json).
- [Eleven browser journeys](evidence/decorative-production/browser-results.json).
- `evidence/decorative-production/`: refreshed production Studio desktop/tablet/mobile, geometry, rainfall, intervention, comparison, decision, image and offline captures.
- [Skill decision ledger](DESIGN_SKILL_DECISIONS.md).

Canonical Studio viewport coverage is 1920Ã—1080, 1707Ã—862, 1536Ã—864, 1440Ã—900, 1366Ã—768, 1280Ã—800, 768Ã—1024 and 390Ã—844 at normal browser zoom. The separate all-view matrix uses 1440Ã—900, 1280Ã—800, 768Ã—1024 and 375Ã—812. Screenshots were visually inspected, including incomplete/error states and coefficient/image disclosures.

## Scientific interpretation and remaining limits

Coefficient ranges cite [TxDOT Hydraulic Design Manual, Rational Method, Table 4-10](https://www.txdot.gov/manuals/des/hyd/chapter-4--hydrology/section-12--rational-method.html). Those ranges originate in a peak-discharge method, not calibrated event-volume performance. TIRTA explicitly records their use here as a user-confirmed pre-planning assumption. The midpoint is arithmetic within a published range, not a separate published recommendation. No unsupported roof-specific explanation is invented for the endpoints.

[USGS SIR 2018-5037](https://pubs.usgs.gov/publication/sir20185037) provides context for material, sediment and maintenance dependence of permeable-pavement performance. It is not used to invent one universal porous-surface coefficient. The guide works offline; opening external reference pages needs connectivity.

Image features are deterministic visual heuristics at a maximum 256-pixel analysis dimension. They are not a trained material classifier and have no claimed real-world accuracy benchmark. Lighting, paint and image scale can confound them. Repetition is image-pixel repetition, not measured paving dimensions; visual variation is not physical roughness. Photographs cannot establish infiltration, imperviousness, capacity, cost or mÂ². Observations with no opaque pixels remain unavailable in the UI. Legacy saved observations without the new feature object remain supported.

Automated accessibility checks and Chrome touch emulation do not replace screen-reader and physical-device assessment. Owner evaluation of the actual experience remains separate. This checkpoint does not assert full competition certification.

The original `E:\TIRTA STANDALONE\codex` and approved `D:\Golden State TIRTA` vault were not mutated. The pre-existing untracked `.rescue-evidence/` folder is retained outside this commit. No dependency or approved base-style replacement was introduced.
