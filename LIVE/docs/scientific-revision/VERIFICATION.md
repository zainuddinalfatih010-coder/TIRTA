# Scientific revision verification

Candidate: E:/TIRTA-SCIENTIFIC-REVISION, codex/scientific-revision. Initial isolated checkpoint361004f; rollback tag scientific-revision-baseline. Latest owner PRD is reproduced in PRD.md. The actual live source copied was E:/TIRTA-CLOUDFLARE-DEPLOY; no publication from this candidate.

## Verified behavior
- Fresh browser project →15×10parcel →roof/confirmedC →60mm →9m³ rainfall and7.65m³ runoff →120minutes →30mm/h average (not peak).
- Declare tank event storage3m³, nominal5m³, cost/space and proposed gutter route; missing resources stay missing. After explicit budget/land, tank becomes conditional and yields a feasible alternative. Comparison exposes declared connectivity, origin, conditions and contextual sources; no automatic winner/highlight.
- Before/after field records produce only descriptive indication once comparison/installation context is declared; save/reload and downloaded report retain observations, assumptions, UNKNOWN and citations.
- UNKNOWN soil excludes only affected combinations. Synthetic uncertainty example shows preliminary/conditional/missing-data states without representing actual field data.
- Contradictory zone routing is rejected in the browser without committing an invalid graph. Unknown/zero duration is distinct; invalid zero duration remains visible for correction.
- Legacy portable import preserves every original parameter exactly, adds empty/UNKNOWN evidence and review markers, exports and reimports without changing10m³ rain/6.27m³ runoff. Repository tests verify archive-before-write and scientific roundtrip.
- Nested references support Escape/focus restoration. New native dialogs pass viewport/scroll/action checks at1440×900,1366×768 and390×844; representative flows pass axe and console/page-error checks. Golden regression pressure-tests canonical desktop/mobile widths and both offline scenarios.

## Automated gates
Commands (PowerShell, candidate root):

```powershell
npm run lint
npm test
npm run build
$env:TIRTA_RESCUE_URL='http://127.0.0.1:4174'
$env:TIRTA_PRODUCTION_PREVIEW='1'
$env:TIRTA_GOLDEN_EVIDENCE='evidence/scientific-revision/golden-regression'
npx playwright test -c playwright.production.config.ts
npx playwright test -c playwright.scientific.config.ts
```

Production preview must already serve the built candidate on4174. Start with `npm run preview -- --port 4174` after building; do not replace the existing live/4173 preview.

Results recorded in evidence/scientific-revision/verification-results.json and the two browser JSON reports. Unit gate:188tests/29files passed. Typecheck is included in build. Full Golden:51cases including offline, two-tab conflicts, geometry/Delete/Undo, responsive and save/reload. Scientific browser:5cases. Final status is recorded after runs complete, never inferred from source inspection.

## Evidence
- browser/rain-duration.png
- browser/alternatives.png
- browser/comparison-evidence.png and comparison-evidence-mobile.png
- browser/feasibility-1440.png, feasibility-1366.png and feasibility-390.png
- browser/field-evaluation.png
- browser/references-mobile.png
- browser/uncertainty-demo.png
- baseline/local-studio.png, local-rain.png, live-studio.png and live-rain.png
- protected-hash-result.json:121protected live-source files compared, zero mismatches.

Images are runtime evidence, not hydrological validation. Browser screenshot/emulation results do not prove performance on a physical phone.

## Scientific review limitations and release gate
25bibliographic records were verified using primary publisher/Crossref metadata and accessible abstracts/previews. Some full texts were inaccessible; no numerical performance is imported from an inaccessible paper. The SNI8456:2017 record is official catalog metadata; licensed normative clauses have not been reviewed. No regulatory/safety certification or undocumented SNI threshold is claimed.

A human scientific reviewer must still examine each displayed claim, coefficient guidance caveat, rule/evidence applicability, explanation and numerical input origin before release. Checklist: confirm paper scope vs claim; confirm actual site soil/groundwater and standards; distinguish nominal vs empty storage; verify proposed routes/overflow; review event-specific capacities and field comparisons. Engineering gates do not replace this review. Actual school-site labeled photos and field measurements are not supplied; existing photo assist/local explanatory AI remains non-authoritative.

Schema note: project2 is retained for repository compatibility and carries science extension1. Absence/empty metadata means UNKNOWN. Old documents and numeric evidence categories are preserved rather than silently recoded. Finite graph declarations do not simulate hydraulics or automatically redistribute runoff.

## Visual scope
Approved Golden palette, typography, layout, canvas/artwork and decoration are retained. Newly introduced reference/feasibility controls use existing native dialog and button conventions; scoped CSS applies only to new scientific controls. Source/fixture/hash parity is separate from this visual review.
