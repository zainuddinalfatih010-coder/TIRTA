# TIRTA_FULL_CONTEXT.md

## Why this file exists
Assume the coding agent has ZERO prior knowledge of TIRTA, the competition, the team, or any previous implementation.
This file teaches the product from first principles so a brand-new Codex/Antigravity project can reason correctly before touching code.

The definitive product authority is still:
- `SOURCE/PROPOSAL-TIRTA-FINAL-SUBMITTED.pdf`
- `SOURCE/MAGE12-APPDEV-GUIDEBOOK-OFFICIAL.pdf`

This document explains those commitments in implementation-oriented language. If wording here ever conflicts with the submitted proposal, the proposal wins.

## Name
TIRTA = **Teknologi Integrasi Resapan, Tampungan, dan Air Hujan**.

## One-sentence definition
TIRTA is an offline-first, parcel/building-scale rainwater **pre-planning decision-support application** that helps non-expert users model a parcel, estimate event rainfall/runoff conditions, explore rainwater-management interventions, and compare transparent trade-offs before detailed professional engineering.

## Why TIRTA exists
A user may know the physical parcel but not have a coherent way to answer:
- how much of the parcel is roof, hard surface, soil, vegetation, or porous surface;
- how a given rainfall event translates into water volume and baseline runoff;
- what happens if storage or infiltration interventions are introduced;
- whether an intervention combination fits available budget and area;
- how alternatives change under different rainfall scenarios;
- which inputs are measured, assumed, user-entered, source-derived, or AI-assisted.
Today these steps can be fragmented across field notes, sketches, calculators, spreadsheets, separate maps, and manual comparisons.
Changing rainfall, an area, a coefficient, an intervention capacity, a cost, or a constraint can force the user to repeat work and may detach the final number from its assumptions.

TIRTA turns that fragmented process into one traceable workflow.

## What kind of product this is
Think of TIRTA as a compact environmental planning workbench.
It is closer in product character to a transparent planning/simulation tool than to:
- a marketing website;
- a generic admin dashboard;
- a chatbot;
- a GIS platform;
- a flood-warning application;
- a black-box recommendation engine.

Its core value is the integration of spatial understanding + deterministic calculation + scenario exploration + constrained decision support + provenance.

## Primary target users
1. **School or educational-building managers**
   They need an early picture of alternatives before proposing facility improvements or consulting a professional.
2. **Owners/managers of small-to-medium buildings**
   They need to understand trade-offs among storage, infiltration, cost, land use, and remaining runoff.
3. **Community members / early-stage planners**
   They need a structured, explainable basis for discussing alternatives.

The pilot used for competition is one school/educational-building parcel measurable by the team.
The product architecture should still be generic enough to support another parcel later.

## User knowledge assumption
The normal user is NOT expected to already understand hydrology, software architecture, provenance schemas, Pareto terminology, or internal data flow.
The application should teach concepts contextually while the user performs the task.
## Core mental model
The product should feel like four connected questions:

### 1. PERSIL
**“Lahan saya terdiri dari apa saja?”**

The user creates or defines the project parcel, divides it into meaningful surface zones, and establishes what is actually known about those zones.

### 2. HUJAN & KONDISI AWAL
**“Kalau hujan X mm jatuh ke lahan ini, kondisi awalnya bagaimana?”**

The user defines one or more rainfall scenarios and calculates deterministic baseline event water balance/runoff from confirmed inputs.

### 3. INTERVENSI
**“Apa yang bisa saya lakukan untuk menangani airnya?”**

The user manually composes or asks the optimizer to evaluate combinations of allowed interventions under declared capacity, budget, and area constraints.

### 4. BANDINGKAN
**“Apa konsekuensi dan trade-off dari pilihan-pilihan tadi?”**

The user compares baseline and feasible alternatives across rainfall scenarios, including cost, land use, storage/reuse/infiltration effects, and residual runoff.

An optional Ringkasan/Overview may orient the user and show project readiness, but it is not a separate scientific stage.

## Core loop
**MODEL -> SIMULATE -> INTERVENE -> COMPARE -> REFINE**

Changing an upstream input should make downstream results visibly stale or trigger controlled recalculation; the user must understand why.
## Parcel and surface model
A parcel is represented spatially in a 2D Studio Persil.

The five core surface classes are fixed:
1. **Atap**
2. **Beton/Aspal**
3. **Tanah terbuka**
4. **Vegetasi**
5. **Permukaan berpori**

Do not introduce additional core classes just because a library or GIS taxonomy offers them.

Zones are spatial objects, not merely rows in a form.
A user should be able to create/select/edit/delete zones and see:
- selected state;
- surface class;
- relevant geometry/area information;
- calculation-readiness information;
- provenance/measurement context;
- relationship to currently displayed analysis.

Important scientific boundary:
a visual polygon may represent spatial placement, but schematic drawing geometry must NOT silently become authoritative metric engineering dimensions unless the app has a defensible measurement/georeference contract.

Never fabricate width × length from polygon area merely to satisfy a calculation.

## Surface class is not a coefficient
Choosing “Atap” or another surface class must not silently inject an unsupported production runoff coefficient.
A coefficient is a scientific input with its own source/provenance/assumption status.
If unknown, it remains unknown until the user supplies or confirms a valid value/source.
## Surface Assist
Surface Assist exists only to reduce input burden for surface classification.

Expected conceptual flow:
1. user selects a zone;
2. user supplies a local photo/image;
3. a lightweight image classifier suggests one of the five surface classes;
4. the app shows confidence;
5. the user confirms or overrides the suggestion;
6. only the user-confirmed class becomes final project truth.

Manual classification must always remain available.

If:
- the model is unavailable;
- inference fails;
- confidence is low;
- an image cannot be used;
then the workflow still works manually.

Surface Assist is NOT:
- a chatbot;
- generative AI;
- a hydrology model;
- an autonomous engineering recommender.

Its output must carry provenance as an assist suggestion until confirmed.

## Rainfall scenarios
TIRTA supports multiple event rainfall scenarios.
A scenario should have at least:
- identity/name;
- rainfall depth in mm;
- provenance/source/status;
- optional user notes/context where appropriate.

Rainfall may be manually entered or come from a clearly sourced local profile/reference.
The application must not silently fetch or invent a rainfall value based on location.
## Baseline event water balance
The MVP uses a deterministic **event** water-balance approach.

Conceptually:
- rainfall depth applies to relevant parcel zones;
- zone area converts rainfall depth into event water volume;
- confirmed runoff/capture parameters determine baseline runoff behavior;
- totals are derived from per-zone results;
- units remain explicit and inspectable.

The implementation must preserve units rigorously.
Typical user-visible units may include:
- mm for rainfall depth;
- m² for area;
- m³/event for event volumes;
- currency for cost.

The exact formula/contract must be implemented from validated project specifications and tests, not improvised from this prose.

Same valid inputs must produce the same outputs.

The calculation engine must not depend on React/UI rendering.

## Baseline meaning
“Baseline” means the starting condition **before proposed interventions**.
It is the comparison reference, not a recommendation or safety state.

Useful baseline presentation may include:
- rainfall depth;
- total rainfall volume;
- baseline runoff volume;
- contribution by zone where valid;
- units and assumptions;
- source/provenance access.

Do not show flood depth, puddle depth, city flooding, hydraulic direction, or safety labels.
## Missing and uncertain data
TIRTA must prefer explicit uncertainty over fabricated completeness.

Important statuses include concepts such as:
- measured;
- user input;
- source-derived;
- Surface Assist suggestion;
- assumption;
- unknown.

If an input required for calculation is unknown:
- show what is missing;
- explain why it matters in plain language;
- point to the place where the user can resolve it;
- do not compute a fake authoritative result.

Where scientifically/product-appropriate, the user may explore a range as explicit scenarios/assumptions.
That exploration must be labelled; it is not the same as measured truth.

## Provenance / Catatan Asumsi
Traceability is a core feature, not an appendix.

For every important parameter the user should be able to understand:
- value;
- unit;
- where it came from;
- evidence/source class;
- method/notes;
- whether it is measured, user-entered, AI-suggested, source-derived, assumed, or unknown;
- what result depends on it.

Normal UI should use plain language first.
Detailed evidence records can be progressively disclosed.

Do not expose raw internal IDs, schema codes, or developer terminology as the first layer of the experience.
## Core interventions
The MVP is deliberately limited to four intervention families:

### 1. Tangki penampung
Represents explicit event-available storage and, where separately declared, explicit reuse-during-event capacity.
Do not substitute nominal tank marketing capacity for validated event-available capacity without a contract.

### 2. Sumur resapan / area resapan
Represents infiltration/resorption capacity only from explicit supported inputs.
Do not invent infiltration from footprint alone.

### 3. Rain garden / taman hujan
Credits only explicit supported event capacity.
Do not double-count temporary storage and infiltration unless the domain contract explicitly models both.

### 4. Permukaan berpori
A proposed permeable treatment is distinct from already-existing porous baseline surface.
Do not double-count the same area as both baseline porous surface and proposed treatment.

Biopori is not a fifth core intervention in the competition MVP.
It may only appear as optional educational material if ever justified.

## Intervention inputs
Depending on intervention type and validated contract, important declared values may include:
- event capacity;
- cost;
- occupied/required area;
- target/eligible zone;
- reuse amount/capacity;
- explicit user/source provenance.

There are no universal hidden production values for these.
## Constraints
The decision-support problem can include hard limits such as:
- total budget;
- usable intervention area;
- option quantity/capacity;
- intervention eligibility.

Hard upper bounds are inclusive: equality may be feasible when the validated contract says `<=`.

A combination that violates a hard constraint must not be presented as feasible.

The user should understand WHY an option is infeasible, not just see it disappear mysteriously.

## Optimizer purpose
The optimizer is not “AI choosing the best design.”

It evaluates a finite, explicitly declared option space under validated rules.

Conceptually it:
1. enumerates/evaluates declared candidate combinations;
2. rejects invalid or infeasible combinations;
3. computes transparent outcomes;
4. filters dominated alternatives;
5. returns multiple non-dominated trade-offs.

It must be deterministic for the same declared inputs/option space.

## Pareto / trade-off behavior
Core objective dimensions include:
- remaining/residual runoff — lower is better;
- total cost — lower is better;
- occupied area — lower is better.

Other result quantities such as retained/reused/infiltrated volume may be presented transparently but must not become hidden weights.

There is NO secret weighted score.
There is NO automatic “BEST” winner.

User-facing wording can say:
- lebih hemat biaya;
- lebih hemat lahan;
- limpasan tersisa lebih rendah;
- pilihan seimbang;
while detailed help may explain non-dominated/Pareto logic.
## Scenario comparison
Bandingkan exists to make consequences visible.

A useful comparison allows the user to inspect:
- baseline;
- alternative A/B/etc.;
- one or more rainfall scenarios;
- residual runoff;
- cost;
- occupied area;
- storage/reuse/infiltration outcomes where supported;
- robustness of trade-offs when rainfall changes.

The user should be able to answer:
- what changed from baseline?
- which option is cheaper?
- which needs less land?
- which leaves less runoff?
- does the preferred trade-off change under a different rainfall event?
- which assumptions most affect interpretation?

Charts/graphics should answer these questions faster than text.
Do not add a chart merely because dashboards usually have charts.

## Export / summary
The user should be able to save the project locally.
A project/export summary may include project inputs, surface zones, rainfall scenarios, assumptions/provenance, selected intervention alternative, comparison outputs, and limitations.

The summary is not a certificate and must not imply regulatory approval.

## Offline/local-first
Core calculation and project workflow must survive without network access.
Local project storage is a first-class requirement.
A reasonable implementation may use IndexedDB for the web runtime and/or SQLite for packaged Android depending on architecture.
## Optional server boundary
A server/account/sync layer may be a future or optional convenience.
It is not required for parcel editing, baseline calculation, scenarios, optimizer, provenance inspection, comparison, or core demonstration.

Do not make login or cloud synchronization block core use.

## Target technology direction from proposal
The submitted proposal anticipates a shared codebase such as:
- React;
- TypeScript;
- Capacitor for Android packaging;
- local persistence such as IndexedDB/SQLite;
- local lightweight image model such as TensorFlow Lite / ONNX Runtime where appropriate;
- SVG/Canvas/open-source visualization for spatial/analytical UI.

This is a direction, not permission to install unnecessary libraries.
Choose dependencies for concrete product value, accessibility, maintainability, offline compatibility, bundle impact, and license compatibility.

## Architectural principle
Keep three conceptual layers separable:
1. **UI / interaction**
2. **domain calculation & decision logic**
3. **data/persistence**

A visual redesign must not require rewriting scientific semantics.
A calculation test must be runnable without a browser.
Persistence/import must validate untrusted/stale data rather than assuming it is valid.
## What TIRTA must never become
Never expand scope into:
- city flood forecasting;
- flood inundation/depth maps;
- river or watershed models;
- drainage network simulation;
- cadastral/legal parcel mapping;
- professional engineering design automation;
- automatic permit/compliance certification;
- Zero Delta Q certification;
- safety guarantees;
- autonomous generative-AI decision making;
- mandatory IoT/sensors;
- paid weather-API dependency.

These may sound impressive but would make the competition product less defensible and violate the proposal boundary.

## What “improvement” is allowed
Agents are encouraged to improve:
- information architecture;
- onboarding;
- interaction design;
- visual hierarchy;
- data visualization;
- accessibility;
- responsive composition;
- empty/error/stale states;
- performance;
- maintainability;
- testing;
- local persistence UX;
- Studio Persil usability;
- explanation of uncertainty;
- export presentation.

Improvements may NOT silently change the scientific/product contract.

## Competition-quality interpretation
The product should look finished and memorable because the spatial model is clear, data relationships are visible, transitions make causal sense, the user knows what to do, uncertainty is treated professionally, and visual craft is consistent.

Competition quality is not achieved by decorative complexity.
## Required end-to-end happy path
From a clean project, a novice should be able to:
1. understand what TIRTA is;
2. create/start a project;
3. define the parcel;
4. create/edit zones;
5. classify the five surface types as applicable;
6. provide the calculation inputs that are actually known;
7. resolve or understand unknown blockers;
8. create/select a rainfall scenario;
9. enter rainfall depth and source/status;
10. calculate baseline;
11. understand rainfall volume/runoff and zone contribution;
12. configure constraints;
13. create intervention options manually and/or declare an optimizer option space;
14. run optimizer;
15. understand feasible vs infeasible behavior;
16. inspect several non-dominated alternatives;
17. compare them across scenarios;
18. save/reload the project;
19. export or view a transparent pre-planning summary.

The UI, not the developer, must guide this journey.

## Required non-happy paths
The product must also behave coherently when:
- no parcel exists;
- a zone is invalid;
- areas/dimensions are incomplete;
- rainfall is unknown;
- coefficient is unknown;
- provenance conflicts;
- an input is negative, non-finite, or blank;
- no rainfall scenario exists;
- constraints are impossible;
- no optimizer candidate is feasible;
- previous results are stale after an input change;
- Surface Assist fails or is low-confidence;
- local data is old/corrupt;
- the network is offline;
- an optional map/context provider is unavailable;
- the viewport is narrow;
- the user uses keyboard or reduced-motion settings.

Never mask these states with fake successful defaults.
## Terminology guidance
Prefer user language:
- Persil
- Zona
- Jenis permukaan
- Hujan
- Kondisi awal
- Limpasan
- Tangki
- Resapan
- Taman hujan
- Permukaan berpori
- Anggaran
- Ruang tersedia
- Asumsi
- Sumber angka
- Pilihan yang layak
- Bandingkan

Use advanced terminology only where it teaches something:
- koefisien limpasan;
- provenance/evidence in detailed help;
- Pareto/non-dominated in optional explanation.

Avoid first-layer UI language such as:
- canonical;
- handoff;
- schema;
- snapshot record;
- declared search space;
- mismatch code;
- internal IDs.

## Key distinction: measured geometry vs visual geometry
A user may draw geometry for spatial understanding.
Scientific area must come from a defensible measurement/data contract.
Do not infer fake width/length from an arbitrary shape.
If map geometry is only schematic, label it as schematic.
If a future implementation gains true georeferencing/measurement, introduce it explicitly and validate it.
## Key distinction: visual intervention placement vs engineering effect
A marker/footprint can show where an intervention is proposed.
Its visual size/location does NOT automatically determine:
- hydraulic connection;
- event capacity;
- infiltration;
- cost;
- reuse;
- effectiveness.

Those remain explicit domain inputs unless a validated model says otherwise.

## Product success test
A mentor/judge should be able to open the app and infer:
1. what the parcel is;
2. what rainfall is being tested;
3. what the baseline condition is;
4. what interventions are being considered;
5. what constraints apply;
6. why multiple alternatives appear;
7. what differs among them;
8. where the numbers came from;
9. what TIRTA can and cannot claim.

If that story requires a developer standing beside the judge and narrating the interface, the product is not ready.

## Final reminder to a brand-new coding agent
Do not confuse “starting from zero” with “invent the product from zero.”

The **implementation and design are greenfield**.
The **product contract is not**.

Read the submitted proposal closely.
Use this document to understand its intent.
Use the other standalone specs to learn the user's accumulated design/UX lessons and required engineering/QA process.
Then build a fresh implementation that is better than the historical attempts without depending on them.
