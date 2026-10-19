# ENGINEERING_PROTOCOL.md

## Purpose
Define how the greenfield TIRTA build should be executed so speed does not create a fragile, confusing, over-generated codebase.

## Core operating principle
Optimize for:
CORRECT, COHERENT, VERIFIED PRODUCT / (REASONING + TOOL + COMPUTE)

Do not optimize for:
- maximum code volume;
- maximum parallel agents;
- maximum visual effects;
- maximum installed libraries;
- maximum test count;
- endless research;
- “looks busy.”

## Before coding
For every meaningful feature:
1. identify the user job;
2. identify domain/science dependencies;
3. identify state/input/output;
4. define acceptance criteria;
5. inspect existing code and patterns in THIS new repo;
6. choose the smallest architecture that can support the requirement cleanly;
7. only then implement.

Do not invent a second parallel architecture when the current one can be extended coherently.

## Recommended stack
Default:
- React
- TypeScript
- Vite
- local-first persistence
- Capacitor for Android packaging
- Vitest or equivalent for domain/component tests
- Playwright for real-browser flow verification

Use alternative libraries only when they materially improve TIRTA and are documented in DECISIONS.md.

## Repository shape
A reasonable starting structure:

src/
  app/
  components/
  features/
    project/
    parcel/
    rainfall/
    interventions/
    compare/
    surface-assist/
  domain/
    water-balance/
    interventions/
    optimizer/
    provenance/
    validation/
  persistence/
  visualization/
  styles/
  test/

Do not treat this layout as sacred. Preserve concept boundaries rather than folder aesthetics.

## Domain isolation
Keep these independently testable without React:
- water balance;
- provenance validation;
- intervention accounting;
- hard constraints;
- candidate generation;
- Pareto dominance/filtering;
- scenario comparison;
- migration/validation helpers.

React components should consume domain APIs, not reimplement formulas.

## State design
Prefer:
- one canonical project model;
- derived values computed from canonical state;
- explicit result/version state;
- local UI state close to the component that owns it.

Avoid:
- the same zone name/class edited in multiple states;
- mirrored React state synchronized by effects;
- effect chains that mutate each other;
- hidden global mutable singletons.

## Effects
Use effects mainly for external synchronization:
- persistence;
- browser events;
- model loading;
- network/optional providers;
- timers/subscriptions.

Do not use effects to simulate a state machine that could be explicit in event handlers/domain reducers.

## Component boundaries
Create components around product concepts:
- ProjectBar
- WorkflowNav
- ParcelCanvas
- ZoneInspector
- RainScenarioEditor
- BaselineFlow
- InterventionComposer
- ConstraintRail
- AlternativeList
- ScenarioComparison
- AssumptionDrawer

Do not split every 10-line visual fragment into a new file.
Do not keep one giant App component that owns every behavior.

## TypeScript
- strict mode;
- avoid any;
- avoid type assertions as escape hatches;
- model nullable/UNKNOWN states explicitly;
- encode units/domain differences in types where useful;
- validate persistence/import boundaries;
- exhaustive switches for fixed surface/intervention families when practical.

## Naming
Use actual TIRTA language.
Good:
- rainfallDepthMm
- areaM2
- runoffCoefficient
- residualRunoffM3
- occupiedAreaM2
- evidenceClass
- selectedScenarioId
- isResultStale

Bad:
- data1
- finalValueNew
- helperManager
- processStuff

## Comments
Comments explain:
- scientific rationale;
- units;
- invariants;
- non-obvious edge cases;
- intentional trade-offs.

Do not narrate obvious JSX.
Do not leave prompt text or AI self-commentary in production source.

## CSS / design system
Build a coherent token system after representative visual direction is approved.

Use:
- semantic colors;
- spacing scale;
- typography scale;
- radius rules;
- elevation rules;
- focus states;
- surface-class tokens;
- motion duration/easing tokens.

Avoid:
- one-off magic values everywhere;
- hundreds of !important overrides;
- file-after-file “final-fix.css” patches;
- viewport-specific hacks that fight each other;
- deeply coupled selectors that leak into unrelated screens.

## Responsive implementation
Use real CSS layout:
- Grid
- Flexbox
- minmax()
- clamp() where appropriate
- container queries where useful
- media queries based on composition breakpoints

Do not scale the app.
Do not shrink text/controls below usability just to fit.

Test effective browser viewport, not screenshot crop dimensions.

## Dependencies
Before adding a dependency, answer:
1. what concrete TIRTA problem does it solve?
2. can native CSS/SVG/platform APIs solve it clearly?
3. runtime size?
4. offline behavior?
5. maintenance/activity?
6. accessibility?
7. license?
8. does it force a visual template?

Document accepted dependencies in DECISIONS.md.

## Open-source freedom
It is explicitly allowed to use suitable open-source:
- icon systems;
- accessible primitives;
- motion libraries;
- canvas/spatial tooling;
- chart/visualization utilities;
- geometry helpers;
- testing tools.

But do not install everything.
The product must still feel like TIRTA, not a component-demo repository.

## Error handling
Expected input failures are modeled data states, not exceptions.
Unexpected failures should remain visible in development.

Never:
- catch everything and return fake success;
- swallow persistence errors;
- replace invalid values with zero silently;
- show stale scientific results as current.

## Persistence
Local-first persistence is mandatory.
Persistence operations should:
- be versioned;
- validate loaded data;
- preserve unknown/null state;
- migrate intentionally;
- avoid blocking core UI unnecessarily;
- expose save status clearly but without fake cloud metaphors.

## Import/export
If project-file import/export is built:
- use versioned schema;
- validate before committing;
- never partially apply a corrupt project;
- provide useful error details;
- preserve provenance and assumptions;
- keep exported format inspectable if practical.

## Git
Use Git from the start.
Recommended checkpoint rhythm:
- bootstrap;
- domain foundation;
- design system/shell;
- Persil;
- Hujan/baseline;
- Intervensi/optimizer;
- Bandingkan;
- Surface Assist;
- offline/import/export;
- hardening.

Do not commit broken builds as “final.”
Do not fabricate noisy human-looking history.

## Diff discipline
Before checkpoint:
- git diff --check;
- inspect changed files;
- remove dead code;
- remove debug logs;
- remove abandoned experiments;
- verify no unrelated file churn.

## Testing rhythm
During implementation:
- focused domain/component tests;
- focused browser flow.

At phase gate:
- relevant full regression;
- real browser canonical states;
- responsive viewport checks.

At final:
- complete suite;
- offline;
- persistence;
- accessibility;
- performance sanity;
- Android packaging/device when owner makes device available.

## Browser verification
Source inspection is not proof.
For every user-visible feature:
- open actual app;
- interact with it;
- check console;
- test populated state;
- test error/empty state where relevant;
- capture screenshot only when it is useful evidence.

## Debugging loop
When something breaks:
1. reproduce;
2. narrow the scope;
3. inspect evidence/logs/state;
4. identify the violated contract;
5. change the minimum justified code;
6. rerun focused check;
7. verify runtime;
8. run regression relevant to touched contracts.

Do not make random configuration changes.

## Harness failures
A broken test harness is not permission to weaken product behavior.
If product behavior is correct and harness is wrong, fix the harness.

## Parallel work
Use parallel/subagents only for genuinely independent investigations or isolated work.
One agent should own shared-file mutation at a time.
Do not run overlapping builders against the same files.

Useful parallel tasks:
- read-only domain research;
- accessibility audit;
- dependency/license audit;
- independent test design;
- visual critique.

## Planning discipline
Create PLAN.md before significant code.
Update it when decisions change materially.
Do not rewrite a 500-line plan every hour.
Keep a concise DECISIONS.md with:
- date/id;
- decision;
- reason;
- alternatives rejected;
- affected contracts.

## Owner interaction
Do not ask the owner for routine engineering decisions already answerable from:
- proposal;
- standalone specs;
- tests;
- runtime evidence.

Ask for:
- subjective visual direction when multiple good options remain;
- scientific/product contract not defined;
- destructive action;
- credentials/login;
- physical phone steps.

## Human-maintainable code gate
Before accepting a feature ask:
- can another developer explain the structure?
- are domain rules in domain code?
- are names consistent?
- is state minimal?
- are errors explicit?
- is JSX reasonably semantic/shallow?
- did we reuse existing concepts?
- did tests target behavior rather than internals?
- did we avoid fake defaults?
- did we inspect the final diff?

## Anti-AI-slop code patterns
Reject/refactor:
- duplicated near-identical components;
- giant wrapper-heavy JSX;
- useEffect domino chains;
- generic Helpers/Managers dumping grounds;
- comments narrating each line;
- fake fallback data;
- meaningless placeholder TODOs;
- dead component variants;
- massive unrelated refactors;
- magic numbers for scientific values.

## Security/basic robustness
At appropriate milestones:
- dependency audit;
- secret scan;
- static security scan;
- sanitize/validate imports and user-entered text where relevant;
- avoid eval/unsafe HTML;
- constrain file/image handling;
- avoid leaking local paths/debug info to end users.

## Performance
Optimize measured bottlenecks.
Priority:
- smooth Studio interaction;
- fast deterministic calculations;
- optimizer responsive for supported declared space;
- reasonable bundle/startup;
- no unnecessary network waits;
- local save not janky.

Do not prematurely micro-optimize simple React screens.

## Completion discipline
Do not call DONE when:
- only unit tests pass;
- only build passes;
- only screenshot looks good;
- only happy path works.

DONE requires the evidence in TEST_QA_ACCEPTANCE.md and owner preview for the visual/product result.
