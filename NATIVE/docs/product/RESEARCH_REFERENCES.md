# RESEARCH_REFERENCES.md

## Status
OPTIONAL RESEARCH SEEDS + METHOD.

This file is NOT a benchmark hierarchy and does NOT define the final UI/UX.
CREATIVE_FREEDOM_CHARTER.md controls design freedom.

## Research goal
Use research to discover interaction/design ideas that serve TIRTA's product problem.

Do not ask:
“Which existing product should TIRTA resemble?”

Ask:
“What interaction patterns from current excellent software could help a non-expert understand and manipulate parcel-scale rainwater planning?”

## Search broadly
Relevant inspiration may come from:
- environmental planning tools;
- GIS/map editors;
- CAD-lite editors;
- architecture/site planners;
- floor-plan tools;
- landscape/garden planners;
- Figma/FigJam;
- Miro/diagramming tools;
- map annotation products;
- data-analysis workspaces;
- scenario/decision-support tools;
- game/editor interactions when useful;
- mobile creative tools;
- dashboardless productivity apps.

The best TIRTA pattern may come from outside hydrology software.

## Optional reference seeds
These are starting points only:
- Autodesk Forma
- Autodesk InfoDrainage
- EPA National Stormwater Calculator
- EPA SWMM
- SCALGO Live
- FloodAdapt
- Mapbox Studio
- Felt
- USGS StreamStats
- HydroCAD
- Figma / FigJam
- Miro
- Floorplanner
- Planner 5D
- QGIS
- ArcGIS editing products
- landscape/site-planning applications

Do NOT copy a full product skin.
Do NOT assume a canvas + right inspector because several references use one.

## Element-level extraction method
Study specific jobs such as:
- creating a spatial object;
- selecting/editing geometry;
- switching edit modes;
- assigning categories/materials;
- inspecting object data;
- showing unknown/invalid state;
- editing measured dimensions;
- placing interventions;
- showing constraints;
- presenting before/after;
- comparing scenarios;
- revealing provenance/assumptions;
- showing stale data;
- onboarding a first-time user;
- responsive/mobile editing.

For each useful pattern record:
- source;
- user job;
- interaction anatomy;
- why it works;
- what TIRTA could adapt;
- what scientific/product meaning must NOT be imported.

## Studio Persil special research
Read STUDIO_PERSIL_MOONSHOT.md.

For Studio, deliberately compare ideas from at least three different product categories, not only GIS/hydrology software.

For example:
- spatial planning/CAD;
- direct-manipulation creative tools;
- map editors;
- floor/landscape planners;
- analytical overlays.

The goal is original synthesis.

## Visual research
Use current real product screenshots/documentation where possible.

Do not rely only on text descriptions or memory.

Evaluate:
- information density;
- first-eye target;
- object affordances;
- discoverability;
- interaction feedback;
- responsive composition;
- accessibility;
- perceived craft;
- performance implications.

## Design concept rule
Research should produce materially different concepts.

A concept is NOT materially different if only:
- palette changes;
- radius changes;
- font changes;
- sidebar switches side;
- cards get shadows.

Differences should change the interaction/composition model.

## Dependency research
For technical libraries, verify current:
- official docs;
- license;
- maintenance;
- browser support;
- bundle/runtime cost;
- accessibility;
- offline behavior.

Candidate categories may include:
- spatial/canvas rendering;
- geometry operations;
- accessible primitives;
- icons;
- motion;
- local persistence;
- chart/visualization;
- image inference.

No library is pre-approved.

## Dependency acceptance
A dependency enters TIRTA only if:
1. it solves a concrete problem;
2. it preserves science/product semantics;
3. core offline behavior remains valid;
4. license is compatible;
5. maintenance/bundle cost is acceptable;
6. accessibility is acceptable;
7. it does not force a template identity.

## Research stop condition
Do not research forever.

For each decision:
1. define the question;
2. compare a small set of credible patterns/options;
3. prototype when needed;
4. record decision/rationale;
5. implement;
6. verify.

Stop when evidence is sufficient to choose.

## Agent-work research principles
For complex builds:
- explore before mass mutation;
- plan;
- use durable workspace instructions;
- verify locally;
- inspect artifacts/diffs;
- course-correct early;
- keep context routed instead of loading every document.

That is why this package uses:
- AGENTS.md;
- specialist specs;
- BUILD_PHASES.md;
- TEST_QA_ACCEPTANCE.md;
- workspace skill routing.

## Final research reminder
References exist to expand creativity, not narrow it.

The final TIRTA UI may look unlike every product named in this file.
