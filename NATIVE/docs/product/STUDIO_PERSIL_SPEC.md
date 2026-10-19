# STUDIO_PERSIL_SPEC.md

## Status
CAPABILITY + TRUTH OUTCOME SPECIFICATION.

This file does not prescribe Studio Persil's visual design, shell, panel arrangement, tool placement, canvas technology, or interaction chrome.
CREATIVE_FREEDOM_CHARTER.md controls design freedom.

## Product role
Studio Persil is the part of TIRTA where the user represents the parcel and its surface zones in a meaningfully spatial way.

The required outcome:
a non-expert can understand and edit what the parcel consists of, then use that same project state in rainfall/baseline/intervention work.

## Required spatial capabilities
The implementation must let the user, through some coherent interaction model:
- establish a parcel/site working area;
- create zones;
- select a zone;
- edit zone geometry/placement;
- delete a zone;
- assign/change one of the five surface classes;
- understand which zone is active;
- inspect/edit calculation-relevant data for the selected zone;
- understand missing/invalid zone data;
- save/reload project spatial state;
- continue into downstream calculation flow.

How these capabilities are exposed is entirely open.

Possible interaction patterns include direct manipulation, drawing tools, guided creation, contextual editing, or another original solution.
Do not assume old TIRTA toolbars/inspectors are required.

## Surface classes
Exactly:
1. Atap
2. Beton/Aspal
3. Tanah terbuka
4. Vegetasi
5. Permukaan berpori

Visual treatment is open.
The five classes must remain distinguishable and consistently mapped to the same underlying meaning.

## Selected-object outcome
The user must always be able to tell:
- what spatial object is selected;
- what data belongs to it;
- what can be edited;
- whether it is ready/valid;
- how to deselect or move to another object.

The agent chooses selection styling and interaction.

## Geometry truth boundary
This is non-negotiable:

Visual geometry is not automatically scientific measurement.

If the spatial editor uses schematic coordinates:
- do not imply GPS/georeferencing;
- do not infer fake north/scale;
- do not derive unsupported engineering dimensions;
- do not fabricate width/length from shape area.

If a future implementation provides true measured/georeferenced geometry, that must be explicit, validated, and documented.

Scientific area/dimensions used by calculations must come from a defensible data contract.

## Geometry validity outcomes
The editor must not allow invalid geometry to silently become canonical project truth.

Handle as applicable:
- self-intersection;
- duplicate/invalid vertices;
- degenerate or near-zero shapes;
- non-finite coordinates;
- invalid containment/parcel relationship;
- corrupted persisted geometry.

Exact algorithms/interactions are open.

## Spatial/scientific separation
Changing a zone's screen position or visual shape must not silently alter scientific values unless the chosen product contract explicitly links them.

Likewise, drawing an intervention marker/footprint must not automatically invent:
- capacity;
- cost;
- infiltration;
- reuse;
- hydraulic connection;
- effectiveness.

## Downstream continuity
Studio Persil is not an isolated illustration.

The same project/zone identity must carry coherently into:
- rainfall/baseline;
- zone contribution analysis;
- intervention targeting where relevant;
- comparison;
- assumptions/provenance.

The user should not wonder whether the spatial work they completed is actually used later.

How continuity is shown is open.

## Surface Assist outcome
For a selected zone, the product may offer Surface Assist.

Required semantics:
- image input;
- suggested one of five classes;
- confidence/status;
- user confirms or overrides;
- manual classification always available;
- failure/low confidence never blocks the core workflow;
- stale async inference cannot overwrite a newer user context;
- final canonical class is the confirmed class, not raw model suggestion.

The exact modal/panel/inline presentation is open.

## Rainfall context outcome
If Studio displays rainfall/runoff context:
- it must correspond to the current active scenario;
- result must be current, not stale;
- zone mappings must match;
- no unsupported hydraulic animation/depth/flow direction.

Studio does not need to display rainfall context if another design communicates continuity better.

## Intervention spatial outcome
If interventions are visualized spatially:
- their identity/target should be understandable;
- visual symbols must not imply unsupported performance;
- visibility should remain coherent when target zones change.

Spatial intervention visualization is desirable when it genuinely helps planning, but its style and geometry are open.

## Empty/start state
The user should understand how to begin using Studio.
Do not leave an unexplained blank editor.

The design of the start experience is open.

## Density/scale outcome
The editor should remain usable with realistic numbers of zones.
As density increases, the UI may adapt labels/detail/controls without changing underlying project truth.

The agent decides zoom behavior, layers, labels, lists, minimaps, contextual tools, or alternatives.

## Offline outcome
Core spatial editing must remain usable offline.

Any optional online basemap/context:
- must not be required;
- must fail gracefully;
- must not create false alignment/georeference;
- must use legal/compatible sources.

A basemap is optional, not a design requirement.

## 2D / 2.5D / other visual modes
No 2.5D mode is required.

The agent may propose one only if:
- it materially improves TIRTA;
- it is scientifically honest;
- precise editing remains reliable;
- it does not fabricate building/terrain detail;
- it does not distract from core workflow.

A strong 2D solution is fully acceptable.

## Responsive outcome
Studio must remain usable at canonical desktop/laptop pressure widths and chosen mobile/tablet targets.

Required:
- spatial work area remains operable;
- primary editing controls remain accessible;
- no overlapping controls;
- no clipped required inputs;
- no whole-app transform scaling;
- touch interactions are viable where mobile editing is supported.

How Studio recomposes is entirely open.

## Accessibility outcome
Where practical:
- controls have accessible names;
- keyboard paths exist for important non-pointer actions;
- focus is visible;
- state is not color-only;
- touch targets are usable;
- reduced-motion preference respected.

## Studio acceptance test
From a fresh project, a first-time user should be able to:
1. understand how to represent the parcel;
2. create multiple zones;
3. edit them;
4. classify them;
5. understand which zone is selected;
6. supply/resolve required data;
7. recover from invalid geometry/input;
8. save/reload;
9. proceed to rainfall/baseline;
10. recognize that later calculations belong to the same project model.

If that works, the Studio design is free to look and behave nothing like any historical TIRTA version.
