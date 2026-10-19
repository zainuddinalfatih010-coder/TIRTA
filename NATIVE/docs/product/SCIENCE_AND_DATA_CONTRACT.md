# SCIENCE_AND_DATA_CONTRACT.md

## Purpose
Define scientific/data invariants for the greenfield TIRTA implementation.
This document is derived from the submitted proposal plus previously validated project semantics.
It exists so a new coding agent does not invent convenient engineering behavior.

The final proposal remains the highest product authority.
If an exact formula/input convention is not resolved by proposal + validated contract + tests, do not guess: represent it as explicit UNKNOWN/ASSUMPTION or create a narrow decision record.

## Fundamental rule
TIRTA is deterministic pre-planning software.
Scientific truth must be traceable to explicit inputs and evidence.
UI polish never authorizes fabricated numeric defaults.

## Core quantities and units
At minimum distinguish:
- rainfall depth: mm
- area: m²
- event water/runoff/intervention volumes: m³/event
- dimension lengths where used: m
- runoff coefficient: dimensionless
- cost: declared currency/value
- occupied area: m²

Never silently mix units.
Use domain types/helpers where practical so rainfall mm cannot accidentally be treated as meters or area as volume.

## Baseline event model
The canonical event relationship is conceptually:
- convert rainfall depth from mm to m;
- event rainfall volume per zone = area × rainfall depth;
- baseline runoff per zone = rainfall volume × confirmed runoff coefficient, under the validated MVP contract;
- totals are sums of valid per-zone results.

A common equivalent expression is:
V_runoff_m3 = area_m2 * rainfall_mm / 1000 * runoff_coefficient

Do not blindly encode this prose without verifying against the submitted proposal/reference fixtures packaged into the new repo.
The implementation must include independent golden tests for units and arithmetic.

Same valid inputs must produce the same outputs.

The calculation engine must not depend on React/UI rendering.

## Determinism
For identical valid canonical inputs:
- baseline result must be identical;
- candidate evaluation must be identical;
- candidate IDs/order must be stable;
- Pareto filtering must be stable.

Do not use time/randomness/network state inside scientific calculations.

## Numeric validity
Reject or explicitly block:
- NaN;
- Infinity;
- negative physical quantities where invalid;
- blank values masquerading as zero;
- unresolved references;
- incompatible units;
- contradictory provenance;
- invalid geometry/area dependencies.

Never persist a successful numeric result created from invalid required input.
## UNKNOWN and no-default policy
Important unresolved values default to UNKNOWN, not numeric convenience values.

Do NOT silently create production defaults for:
- rainfall;
- runoff coefficient;
- intervention event capacity;
- infiltration capacity;
- reuse capacity/demand;
- intervention cost;
- occupied area;
- usable intervention area;
- budget;
- pilot measurements.

If the UI needs a demo:
- use an explicit “Load demo” action;
- mark data as SIMULATION / DEMO DATA;
- do not blur demo state with a real project.

## Provenance model
A parameter should support a primary evidence/provenance class such as:
- MEASURED
- USER_INPUT
- SOURCE_DERIVED
- ASSIST_SUGGESTION
- ASSUMPTION
- SIMULATION / DEMO DATA
- UNKNOWN

Names may be adapted in code if semantics remain clear.

A provenance record should be able to carry:
- parameter identity;
- value;
- unit;
- evidence class;
- source/method;
- timestamp/version where useful;
- user note;
- limitation/applicability note.

If a calculation input references a provenance record, its declared evidence class/unit must match the resolved record.
Contradictory reference vs record metadata must reject with no numeric output.

## Surface classification
Surface class and runoff coefficient are separate concepts.
Do not map one to the other silently.

Surface Assist:
- suggestion is not canonical class;
- confidence is not scientific confidence in runoff behavior;
- only explicit user confirmation/override establishes final class;
- manual path must always work.

## Geometry/data boundary
Visual map footprint is not automatically scientific area.
Scientific area must come from a defensible measured/model input.
Do not derive fake width/length from polygon area.
Do not infer GPS, elevation, slope, drainage direction, or connection from visual placement.

## Baseline result structure
A useful result should be inspectable:
- scenario ID/version;
- input rainfall depth + provenance reference;
- per-zone area;
- per-zone coefficient;
- per-zone rainfall volume;
- per-zone baseline runoff;
- totals;
- unit metadata;
- provenance references;
- calculation version;
- conservation/consistency indicators where relevant.

The UI may simplify this, but validation/test APIs should expose enough detail to audit arithmetic.
## Intervention families and semantics
Exactly four core families:

### STORAGE / Tangki
Model explicit event-available storage.
If reuse-during-event is supported, retained volume and reused-during-event volume are separate, mutually exclusive dispositions.
Do not count the same cubic meter as both retained and reused.
Do not substitute nominal tank size for event-available storage unless the user/source explicitly defines it that way.

### INFILTRATION / Sumur atau area resapan
Canonical MVP performance input is explicit event infiltration capacity in m³/event (or an equivalent validated representation).
Do not infer infiltration capacity from area alone.
Do not invent soil infiltration rate integration unless separately validated.

### RAIN_GARDEN
Credit only explicit supported event capacity.
Avoid double-counting temporary storage and infiltration.
If only infiltration capacity is validated, use only that.

### PERMEABLE_SURFACE intervention
Proposed permeable treatment is separate from existing porous baseline surface class.
Do not double count treatment over area that is already represented as baseline porous unless the domain contract explicitly models the transition.
Target eligibility/overlap must be validated.

## Allocation/conservation
Intervention accounting must conserve event volume.

A conceptual partition may include:
- retained/stored;
- reused during event;
- infiltrated;
- residual runoff.

For each evaluated alternative:
baseline_runoff ≈ retained + reused + infiltrated + residual_runoff
within an explicitly defined numerical tolerance.

Do not create “removed water” that is not assigned to a supported disposition.

Allocation priority must be explicit and deterministic.
Never introduce a hidden order that changes results without being visible in the option/contract.

## Hard constraints
Typical hard constraints:
- total cost <= budget;
- occupied area <= usable area;
- per-option quantity/capacity/eligibility limits;
- target/overlap rules.

Equality at a hard upper bound is feasible.
Constraint comparisons should use unrounded internal values.
Display rounding must not affect feasibility.

Return margin/violation detail useful for explaining feasibility.
## Optimizer declared search space
The optimizer evaluates only explicitly declared finite options.
It must not hallucinate arbitrary intervention sizes, costs, or capacities.

A candidate is the deterministic combination of declared choices/quantities permitted by the current optimizer contract.

Requirements:
- deterministic enumeration;
- stable candidate identity;
- stable output ordering;
- explicit infeasible state/reason;
- no silent truncation.

If a safety/performance candidate limit exists:
- it must be explicit;
- excessive search space must return a clear error/instruction;
- never silently evaluate only the first N and pretend it was exhaustive.

Historical validated implementation used an explicit finite exhaustive search and a benchmarked guard; the greenfield implementation may improve the threshold/algorithm only if it preserves exhaustiveness/semantic equivalence for supported declared spaces and is verified.

## Objective semantics
Core Pareto objectives:
1. remaining/residual runoff — minimize
2. total cost — minimize
3. occupied area — minimize

Use internal unrounded values for comparisons.

Candidate A dominates B when A is no worse on all active objectives and strictly better on at least one.
Return all non-dominated feasible candidates subject to any explicit presentation cap that does NOT alter dominance semantics.

No weighted best score.
No hidden user preference weights.

If future user-defined preference/ranking is added, keep it as a separate transparent presentation layer over the Pareto set.

## Scenario comparison
A selected alternative can be evaluated across multiple rainfall scenarios.
Do not assume an alternative selected under one event remains “best” under others.
Comparison must preserve:
- same intervention definition;
- scenario-specific baseline/result;
- explicit stale/version status when inputs change.

## Stale-result/version policy
Every scientific result must be associated with the input version/hash that produced it.
If upstream scientific input changes:
- mark dependent result stale immediately;
- either recalculate explicitly or require user action according to UX;
- never show a stale number as current without a visible warning.

Inputs that can stale downstream results include:
- zone area/dimensions;
- coefficient;
- rainfall;
- provenance changes that alter validity;
- intervention capacity/cost/area;
- constraints;
- option-space changes.

## Persistence/import
Local persistence must preserve scientific distinctions.
On load/import:
- validate schema/version;
- migrate explicitly when safe;
- reject/correct corrupted non-finite values;
- preserve UNKNOWN;
- never fill missing legacy fields with fabricated scientific defaults.

Provide a versioned project export/import format if implemented.
Unknown/newer versions should fail safely with actionable messaging rather than partially corrupting state.
## Surface Assist model/data boundary
A real classifier may be local ONNX/TFLite or another suitable offline-capable approach.

For production claims:
- model file/version must be known;
- five-class label mapping fixed;
- preprocessing deterministic;
- inference errors handled;
- confidence semantics documented;
- evaluation dataset and metrics separated from training data;
- stale async results rejected;
- user confirmation required.

Do not claim high accuracy without measured evidence.
If a competition build cannot ship a defensible model, preserve the complete manual workflow and mark Surface Assist availability honestly rather than faking inference.

## Local/offline behavior
Scientific engine and optimizer must not require:
- API keys;
- weather API;
- database server;
- cloud model inference;
- hosted map.

Optional network context must have a local fallback.

## Error contract
Expected validation failures are structured outcomes, not crashes.
Prefer field-specific errors with:
- stable code;
- field/path;
- user-facing safe message;
- technical detail for tests/debug;
- no numeric scientific output when required inputs are invalid.

UI should translate technical errors into plain actionable language.

## Reference/golden testing
Build independent tests for:
- zero rainfall;
- known simple area/rainfall/coefficient arithmetic;
- multiple-zone sums;
- unit conversion;
- coefficient 0 and 1 boundaries if allowed;
- missing/UNKNOWN required input;
- negative/non-finite rejection;
- provenance class/unit mismatch;
- deterministic repeatability;
- conservation;
- constraint equality;
- infeasible candidate;
- dominated candidate;
- multiple non-dominated trade-offs;
- stable candidate IDs/order;
- excessive option space behavior;
- stale-result invalidation.

Do not copy production calculation logic into the test oracle line-for-line.
Use hand-computed/reference fixtures or an independent calculation path.

## Claims firewall
The application may say:
- estimate;
- scenario;
- pre-planning;
- based on entered/assumed data;
- compare alternatives;
- remaining runoff estimate.

Do not say without separate evidence:
- prevents flooding;
- safe;
- compliant;
- certified;
- optimal engineering design;
- guaranteed infiltration/storage performance;
- verified pilot accuracy;
- AI accuracy percentage.

## Science completion gate
A domain feature is accepted only when:
- inputs/units are explicit;
- invalid/UNKNOWN behavior is correct;
- provenance trace works;
- deterministic tests pass;
- conservation/constraints pass where applicable;
- runtime presentation does not overclaim;
- no hidden default was introduced.
