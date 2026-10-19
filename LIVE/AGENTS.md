# AGENTS.md â€” TIRTA Standalone

## Mission
Build a new competition-grade TIRTA from zero.

Realize the submitted proposal faithfully while using your own product/design intelligence.

## Authority order
1. SOURCE/PROPOSAL-TIRTA-FINAL-SUBMITTED.pdf â€” product/scope authority.
2. SOURCE/MAGE12-APPDEV-GUIDEBOOK-OFFICIAL.pdf â€” competition authority.
3. docs/product/SCIENCE_AND_DATA_CONTRACT.md â€” validated truth/domain rules.
4. ../AGENT/CURRENT/DECISIONS.md â€” authority for design freedom.
5. docs/product/PRODUCT_CONSTITUTION.md â€” concise product invariants.
6. docs/product/UX_VISUAL_BLUEPRINT.md / docs/product/STUDIO_PERSIL_SPEC.md â€” outcome requirements only.
7. docs/product/USER_FEEDBACK_AND_PEMBINA.md â€” historical failures/mentor requirements only.
8. ../AGENT/CURRENT/ENGINEERING_PROTOCOL.md / ../AGENT/README.md / ../AGENT/README.md.
9. Current source/runtime/tests in THIS repository.

If a derived file conflicts with the proposal or scientific contract, the higher authority wins.
If a derived file prescribes a historical visual style/layout, ../AGENT/CURRENT/DECISIONS.md wins.

## Greenfield firewall
Do not inspect/copy older TIRTA source, CSS, screenshots, components, assets, layout, visual identity, or architecture unless the owner explicitly requests forensic comparison.

Historical lessons already live in this package.

## Creative UI/UX freedom
The following are intentionally NOT locked:
- palette;
- typography;
- layout;
- navigation morphology;
- panels;
- inspector placement;
- card usage;
- visual identity;
- iconography;
- motion;
- data-viz style;
- responsive composition;
- mobile UX;
- Studio chrome;
- screen decomposition.

Design from first principles.

Do not reproduce old TIRTA merely because historical notes describe it.

## Persistent product/science invariants
- Parcel/building-scale rainwater pre-planning decision support.
- Five surface classes only: Atap; Beton/Aspal; Tanah terbuka; Vegetasi; Permukaan berpori.
- Four core intervention families only: Tangki; Sumur/area resapan; Rain garden; Permukaan berpori.
- Deterministic event water-balance.
- Same valid scientific input => same result.
- UNKNOWN stays UNKNOWN.
- No hidden scientific defaults.
- Surface Assist requires user confirmation/override; manual classification always works.
- Multiple rainfall scenarios.
- Important values retain units/provenance/assumptions.
- Optimizer evaluates declared options under explicit constraints.
- Return multiple non-dominated/Pareto trade-offs; no hidden weighted BEST.
- Core workflow offline/local-first.
- TIRTA is pre-planning, not flood/safety/compliance certification.

## Product-story invariant
The user should understand:
Persil -> Hujan & Kondisi Awal -> Intervensi -> Bandingkan.

This is a mental model, not a mandatory page count/navigation implementation.

You may improve IA/screen decomposition if all capabilities/science remain correct and the rationale is recorded.

## UX outcome
Every important task should make clear:
- what the user is doing;
- what is selected;
- what is missing;
- why it matters;
- what changed;
- whether results are current;
- where numbers come from;
- what can happen next.

Do not expose internal implementation jargon as first-layer UI.

## Responsive outcome
The app must adapt at 100% zoom across canonical desktop/laptop widths and mobile/tablet targets.

No:
- whole-app transform scaling;
- overlap;
- clipped required controls;
- hidden required input;
- broken horizontal page overflow;
- unusable spatial workspace.

How the layout adapts is up to you.

## Engineering behavior
Before mutation:
- inspect relevant contracts/current code/tests;
- define acceptance;
- implement the smallest coherent change;
- verify with targeted tests and real runtime;
- inspect regressions.

Keep scientific/domain calculations outside React rendering.
Validate import/persistence/user boundaries.
Do not fabricate fallback science.

## Evidence discipline
Source inspection is not runtime evidence.

For meaningful user-visible changes:
- test actual browser behavior;
- test populated state;
- test relevant error/empty/stale states;
- check console/page errors;
- pressure-test nearby responsive widths.

## Owner preview
For a major new art direction, especially Studio Persil:
- read docs/product/STUDIO_PERSIL_MOONSHOT.md;
- create competent representative concepts first;
- show populated output;
- explain trade-offs;
- ask the owner to choose/approve.

Do not ask the owner to specify colors/layout before you have strong original concepts.

## Completion rule
Never claim complete until:
- core journey works from clean state;
- science/domain invariants pass;
- persistence/save-reload works;
- offline core works;
- responsive matrix passes;
- accessibility baseline passes;
- canonical runtime has no critical errors;
- lint/type/test/build pass;
- representative evidence exists;
- owner has seen actual product;
- known limitations documented;
- repository is clean.
