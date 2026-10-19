# Submitted proposal → production traceability

12 September 2026. PDF page references are physical pages (24 total); printed main-body pages are five less. Status is actual current scope after inspection, not promised implementation. **V** = retained validated domain foundation; **P** = interactive synthetic prototype only; **M** = missing production implementation; **E** = external/pilot/release evidence not supplied. Current evidence does not prove competition readiness.

| ID / proposal requirement and location | Product feature / screen | Domain / engine responsibility | Current status and missing work | Acceptance test / gate |
|---|---|---|---|---|
| P01 Identity, nonexpert parcel pre-planning (pp.6,9–11) | Proyek orientation, same parcel across7 destinations | Real/demo project identity, readiness | P; real create/open lifecycle M | Clean-state novice journey C-13; B/K |
| P02 2D zone model and five surfaces (pp.6,15,20) | Studio authoring | Geometry, selection IDs, scientific area/class refs | P existing-zone movement/vertex; full parcel/create/delete/pan/redo M | C-04 geometry/gestures/reload; C |
| P03 Basic dimensions/pilot measurements (pp.15,24) | Area method and measured dimensions in Studio | Explicit m inputs, measured rectangle A=L×W; direct nonrectangular area | Direct area domain V; measured-input UX/schema M; pilot E | Source trace, dimensions independently entered, schematic edits science-neutral; A/C/K |
| P04 Narrow local photo classifier, five labels, confidence, confirm/manual fallback (pp.6,10,12–14,20,22) | Selected-zone Kenali dari foto | Model adapter, label mapping, revision-safe confirmation | M; no trained model/dataset claims | SA-T01–09; D/J/K |
| P05 Deterministic event water balance (pp.10,12) | Hujan → baseline/contributions | A×P/1000×C, units/resolution | V baseline and39 domain tests; integrated P; full production wiring M | Independent golden arithmetic/UNKNOWN/unit/evidence boundaries; A/E |
| P06 Multiple rainfall scenarios/manual or sourced local profiles (pp.6,10,15) | Hujan create/edit/source | Scenario identity and references; no weather dependency | V scenario type, P3fixed demo cases; full CRUD/profiles M | New scenarios, blank/source error,0mm, source edit stale; E |
| P07 Four intervention families (pp.6,10,15,20) | Intervensi composer | Event capacity, target and allocation ledgers | P tank/garden2binary options; all4 production engines M | C-06 fixtures plus each family UNKNOWN/target/area/cost; F |
| P08 Tampungan / pemanfaatan (pp.6,9,12) | Tank storage and explicit reuse mode; payoff | Single capture, exclusive retained/reused quantities, no turnover | P storage only; reuse M | S6/D4/B10→stored2,reused4,residual4; F/H |
| P09 Input-based resapan and rain garden (pp.6,10,12) | Capacity/source on composer | Explicit per-event supported infiltration; no rate inference | P garden fixed9; source/per-scenario capacity composer M | No area→K default, no stored+infiltrated double credit; F |
| P10 Porous intervention distinct from baseline class (pp.6,10,20; science refinement) | Partial treatment hatch/area | C-06a incremental capacity, local runoff fraction, exclusions | M | T40/A100/B10/K5→H4; existingporous/overlap reject; F |
| P11 Manual composition + optimizer (pp.9,13,15) | Intervensi saved manual plans, Alternatif | Exact declared variant groups, definitions and constraints | P four fixed combinations only; production authoring/enumeration M | Same evaluator for manual/search, explicit finite choices; F/G |
| P12 Budget/space/capacity limits (pp.6,9,12,14–15) | Constraint rails, site allocations | Raw <= comparisons, per-option capacities, exclusions/site/global land | P demo budget/global area; native site/quantity controls M | Equality, violation, unsupported target, no double debit; F/G |
| P13 Dominance/trade-offs, not one unexplained score (pp.12–13) | Equal-salience alternative set | Three-objective Pareto, deterministic IDs/ties/duplicates/counts | P isolated evaluator; general production M | Dominated removal/equal-objective distinct plans retained/noBEST; G |
| P14 Planning goal/priority (p.15) | Focus cost/space/runoff/all + goal note | Transparent sort/view only, immutable Pareto set | M | Focus switch cannot change membership/feasibility/selection; G |
| P15 Scenario robustness/comparison (pp.6,13,15,21) | Bandingkan | Same definitions across events, explicit profiles, common scales | P fixed plans×3rains; user shortlist/revisions M | No stale mixed versions, unavailable≠zero, no probability score; H |
| P16 Uncertainty/ranges and sensitivity A/P/C/K (pp.14–15,18,22) | Uji asumsi + labelled sensitivity cases | Explicit override refs, source validity, area reconciliation | P rainfall changes only; richer sensitivity cases M | Independent one-parameter changes, missingrange notinvented; E/F/H |
| P17 Catatan Asumsi and traceable inputs (pp.6,9,13,15,18,21) | Inline source indicators + inspectable appendix | Evidence/ref integrity incl confirmed Assist lineage | V numeric evidence, P synthetic disclosure; categorical history/full production M | Every result source resolves; mismatch blocks; A/D/H/I |
| P18 Costs, land, storage/reuse/infiltration/residual outputs (pp.6,9,13,21) | Rencana & Dampak coherent decision package | Exclusive conservation partition/margins | P storage+infiltration+residual; reuse/full sources M | C-08 requiredfields, zero-state/UNKNOWN/current checks; H |
| P19 Save user-chosen plan and export (pp.11,15) | Save/restore plus transparent report | Stable plan definition/context, versioned backup, report snapshot | P localStorage/TXT; production storage/reports M | Read-after-reload, explicit choice, printableHTML/PDF/JSON; B/H/I |
| P20 Offline core/project/pilot/model (pp.6,10,12–13,18–19,22) | Offline launch and local work | IDB/SQLite/cache/APK assets | P loaded-session offline; coldlaunch/native/model M | Cold browser after cache, first installed APK launch airplane mode; B/D/J |
| P21 React/TS/Capacitor, isolated engine/data (pp.12,18–19) | Maintainable app/platform layers | Pure domain + adapters; Android build | V React/TS/baseline; Capacitor/SQLite M | Strictbuild/APIboundary/nativeadapter roundtrip; A/B/J |
| P22 Optional server only, no unnecessary generativeAI/IoT (pp.10,12–13) | No account/network in core journey | No cloud runtime dependency | V/P current no server; production regression required | Blockallnetwork and finish core workflow; J/K |
| P23 Single measured school/educational pilot (pp.6,10–11,17,24) | Real pilot project separate from demo | Provenance and field applicability | E; school example is synthetic, no measurements inferred | Measured dataset, independent reconciliation, permissions; K |
| P24 Accuracy/manual reference testing (p.14) | Evidence report and method disclosure | Independent calculation oracles | V simple golden baseline; four-family/scenario reference M | Golden/worksheet fixtures, conservation and units; A/F/K |
| P25 Classifier confusion + weak classes (p.14) | Honest model evaluation report | Grouped split, held-out metrics/calibration | E/M | SA-06 frozen evaluation and limitations; D/K |
| P26 Nontechnical usability, pilot metrics, technical review (pp.14,17) | Uncoached full journey | Instrument task time/compared alternatives/comprehension/reference agreement | E; browser automation is not novice study | Observed tasks and technical input review, no fabricated outcomes; K |
| P27 Scope/claims (pp.6,10,13,18,22) | Everywhere and export | No flooddepth/peak/safety/certification API | V/P bounded claims; production claimaudit M | Search+runtime report review, nogeofakes/noBEST; K |
| P28 Android final and demo/video (p.17) | Installed APK and demonstration | Local packaged assets, lifecycle/release build | M/E | SignedAPK physical offline smoke + video; J/K |

## Competition traceability (official packaged guidebook)

| ID / guidebook requirement | Planned delivery | Current gap | Acceptance |
|---|---|---|---|
| G01 All main proposal features; .exe or .apk (PDF pp.12–13) | Capacitor Android APK, all P01–P28 | Web prototype alone insufficient | GateK checklist + installation/launch |
| G02 Original work and licensed assets (pp.6–7) | Greenfield source, font/icon/model/data licences and notices | Final dependency/model/data licence inventory missing | Licence/secret/dependency scan and attribution |
| G03 Video720p MP4≤5min, background+preview+usage (pp.12–13) | Recorded truthful full flow | Not created | Probe dimensions/duration and human review |
| G04 App+video RAR filename MAGE 12_Tahap 2_AppDev_[Nama Tim].rar, accessible submission link (pp.12–13) | Verified package using submitted team identity | Not packaged/uploaded; publishing separate approval | Archive extraction/hash + user-authorized public link check |
| G05 Presentation/source on request/X-banner, final functioning work (p.14) | Final-stage materials and reproducible build | External final-stage work outstanding | Owner/team deliverables and demo rehearsal |

Dates/rules here reflect the **supplied official PDF**, not a claim that live organizer updates were checked. Before actual submission, verify any organizer amendments with owner/current official source.

## Status evidence anchors

`src/domain/model.ts`, `validation.ts`, `baseline.ts` and tests: retained foundation. `src/direction/planning.ts`: hardcoded two-option demo, four fixed packages, explicit provenance limitations. `Parcel.tsx`: fixed schematic boundary/900m² display, selection/move/vertices/undo; not complete authoring. `main.tsx`: seven views, demo loading, localStorage save/open and TXT download. `Visuals.tsx`: reuse currently not modelled. `INTEGRATED_PREVIEW.md` documents limits. Approved runtime images and `evidence/integrated/QA.md` establish prototype behavior only; new freeze/integrity evidence is in `evidence/closure/`.

Conclusion: the **direction is aligned**; the **application is not proposal-complete**. Missing rows remain explicit work in the production plan rather than being relabelled complete because a demo visually suggests them.
