# Scientific domain design

This is an isolated revision of the owner-approved live foundation. Geometry, surface taxonomy, event baseline formula, units and local AI inference infrastructure are preserved.

## Additive canonical model
Project schema remains2 for compatibility with existing repository envelopes. An explicit `science.schemaVersion=1` extension carries optional surface context, scenario duration, declared source routes, intervention evidence and post-installation observations. Unknowns use null/unknown/empty evidence, never inferred zero or medians. Unrecognized versions and unknown keys are rejected. Measured numbers require source, method and date. Units are field-specific.

Stored numerical parameters retain existing uppercase evidence categories. Additional evidence uses measured/user_supplied/literature_guidance/derived/legacy_fixture/unknown. Performance origins use measured/design-declared/literature-guided/user-entered/unknown. These are distinct concepts, not a lossy recoding of old parameters.

Surface metadata never assigns C, infiltration or metric geometry. Existing porous systems affect only the supplied baseline. Proposed conversion requires one impervious target, bounded positive treated area and explicit system/spec/performance/subgrade dependencies.

## Declared graph
Existing zone routes and candidate-specific planned routes are separate declarations. `candidateId` scopes a proposed connection to its option; different options can declare alternative source connections without inventing simultaneous flow fractions. Multiple contradictory destinations within one scope, dangling endpoints, zone cycles and overflow cycles are invalid. A combined plan follows its declared accounting priority. No proximity, elevation, flow rate or hydraulic timing is inferred. Routing only gates access to original source-zone event volumes; it never duplicates upstream volume.

## Feasibility
Pure assessIntervention returns FEASIBLE_PRELIMINARY, FEASIBLE_WITH_CONDITIONS, MORE_DATA_REQUIRED or INFEASIBLE_WITH_AVAILABLE_DATA with reasons, missing items, conditions, claim/evidence IDs and field checks. Reject takes precedence over missing; missing over conditional. Neither feasible status certifies construction or safety.

Storage requires source connections, nominal/available capacity consistency and explicit numerical performance. Unknown overflow/operation leaves conditions. Infiltration requires soil/permeability evidence, groundwater/local-requirement review. Garden also requires media/vegetation context. Conversion needs specifications and subgrade checks when dependent. Unknown critical performance is not a numerical benefit.

Performance evidence binds to the parameter identity and revision. Non-storage evidence additionally binds to depth and duration context; changes require review. Scientific evidence is snapshotted with declared plans. Frozen performance can be reused only while current contextual evidence remains unchanged. Modified environmental context invalidates decisions; observations alone do not invalidate predictive inputs.

## Ledger and finite search
Original event-volume debit/conservation equations are retained. Strict scientific screening precedes numerical treatment. Incomplete individual candidates are excluded, not silently completed and not allowed to poison independently complete candidates. Global baseline/budget/land must still be known. Existing finite10,000-candidate ceiling and unweighted Pareto residual/cost/area remain. Automatic lowest-runoff recommendation presentation is removed per this PRD; user selects priorities and the plan.

## Field observation boundary
Before/after observations attach to a plan identity/revision. Dates, rain, duration, ponding, location, notes, optional bounded raster photo and installation/maintenance context are preserved. Descriptive assessment returns indication improved, insufficient data or review needed. One pair does not prove causation/model accuracy. Equal absence of ponding does not imply improvement. Photos are not processed into science values.

## Module responsibilities
scientificContract: schema; scientificAuthoring: unknown scaffolding and average event intensity; sourceRouting: graph boundary checks; feasibility: rule screening; fieldEvaluation: descriptive assessment; evidenceRegistry/evidenceCatalog: contextual primary evidence; scientificExport: traceable report. React controls only edit these canonical structures via existing store/repository.
