# STUDIO_PERSIL_MOONSHOT.md

## Status
SPECIAL CREATIVE MANDATE.

Studio Persil is the HERO FEATURE of TIRTA.

The owner explicitly wants Codex/Antigravity to push this part much further than previous implementations.
Do not preserve historical Studio UI merely because it already works.

Preserve only:
- valid domain/science rules;
- project data integrity;
- required capabilities;
- testable behavior.

The interaction model, visual language, rendering approach, workspace composition, and spatial storytelling may be completely reinvented.

## Moonshot question
Do NOT ask:
“How do I polish the current Studio?”

Ask:
“If TIRTA were designed today by a top product/design/engineering team, what is the most compelling spatial parcel-planning experience we could build within the proposal?”

## Desired reaction
A judge/user opening Studio Persil should quickly feel:
- this is a real planning tool;
- I can understand my parcel spatially;
- editing feels direct and satisfying;
- surfaces are visually meaningful;
- results connect to the exact parcel/zones I created;
- interventions feel placed into a real plan, not just listed in forms;
- the workspace is sophisticated but still understandable.

## Creative freedom
You may redesign from zero:
- canvas technology;
- rendering engine;
- 2D visual style;
- optional 2.5D presentation;
- parcel creation method;
- zone drawing/editing model;
- object handles;
- snapping;
- guides;
- measurement assistance;
- context layers;
- background/reference image support;
- selection model;
- layer management;
- inspector/list patterns;
- contextual action menus;
- toolbars;
- command palette;
- keyboard shortcuts;
- hover/selection microinteractions;
- labels;
- surface material rendering;
- intervention placement;
- intervention symbols;
- analytical overlays;
- scenario overlays;
- compare overlays;
- onboarding;
- mobile/tablet editing model.

Do not assume old tools, old sidebar, old inspector, old toolbar, or old canvas structure are correct.

## Explore before freezing
Create and evaluate at least 3 materially different Studio concepts.

They must differ in interaction/product grammar, for example:
- direct manipulation spatial editor;
- guided parcel-building workflow;
- map/planning workbench;
- hybrid spatial + analytical canvas;
- another original concept.

These are examples only.
Do not force them.

For each concept evaluate:
- first-time learnability;
- editing speed;
- visual impact;
- scientific honesty;
- responsiveness;
- intervention planning potential;
- implementation complexity;
- offline viability.

Then prototype the strongest direction with real TIRTA content.

## Research mandate
Research beyond previous TIRTA references.

Study current best examples from:
- CAD-lite tools;
- floor-plan editors;
- landscape/site planners;
- map editors;
- GIS-lite products;
- Figma-like direct manipulation;
- diagramming/spatial products;
- property/site planning apps;
- architecture tools;
- data-rich map products;
- game/editor interaction patterns when relevant.

Possible sources include:
- Autodesk Forma
- InfoDrainage
- Mapbox Studio
- Felt
- ArcGIS Experience Builder / Field Maps patterns
- Figma/FigJam
- Miro
- Floorplanner
- Planner 5D
- QGIS interaction ideas
- garden/landscape planners
- modern CAD-lite web apps

Do not copy their skin.
Extract interaction ideas.

## Spatial experience ambition
Studio should be able to feel richer than a flat colored polygon editor.

Potential directions you MAY explore:
- subtle material treatments for roof/concrete/soil/vegetation/porous surfaces;
- parcel boundary context;
- smart snapping/guides;
- vertex/edge affordances;
- measurement overlays;
- hover metadata;
- selected-zone contextual actions;
- intelligent label decluttering;
- fit-to-project;
- mini overview/map;
- layer toggles;
- reference image underlay;
- optional context map;
- intervention ghost preview before placement;
- before/after overlay;
- scenario-dependent analytical overlay;
- contribution heat/choropleth-like styling only when backed by real values;
- constraint-aware placement cues;
- area usage visualization;
- compare mode with ghosted alternative geometry;
- visual storytelling from surface -> runoff -> intervention.

Nothing in this list is required.
Choose only what genuinely improves TIRTA.

## Direct manipulation ambition
Where appropriate, editing should feel immediate:
- select object directly;
- drag/move;
- resize/reshape;
- edit vertices;
- add/remove vertices;
- duplicate when useful;
- multi-select if it helps real workflows;
- snap/align when useful;
- undo/redo;
- keyboard delete/escape/enter;
- contextual actions near the object.

Do not make the user repeatedly leave the canvas to edit simple spatial properties in forms.

## Parcel creation innovation
You may explore better ways to define the parcel:
- direct drawing;
- dimension-assisted rectangle;
- polygon drawing;
- reference-image tracing;
- guided measured-input workflow;
- hybrid measured + visual model.

Science rule:
visual convenience must not fabricate authoritative metric dimensions.

If a measured dimension drives science, make that explicit.

## Surface visualization ambition
Surface classes should be instantly distinguishable.

You may use:
- color;
- texture;
- subtle pattern;
- iconography;
- material cues;
- labels;
- shading.

Avoid excessive realism that implies physical properties not actually modeled.

## Analytical overlays
Studio may become a bridge between modeling and analysis.

Potential overlays:
- surface class;
- calculation readiness;
- missing/UNKNOWN inputs;
- rainfall contribution;
- baseline runoff contribution;
- current intervention coverage;
- residual runoff contribution;
- constraint usage.

Any overlay MUST come from valid current data.
No fake hydraulic flow/depth.

## Intervention planning ambition
Interventions should feel spatial when spatial meaning exists.

Explore:
- drag-to-place;
- target-zone assignment;
- footprint preview;
- ghost preview;
- capacity/cost tooltip;
- constraint warning;
- visual eligibility cues;
- before/after overlay;
- selected alternative preview.

But never infer capacity/effect from icon size unless the contract explicitly maps them.

## Optional 2.5D / perspective
You may explore 2.5D only if it improves comprehension and polish.

Rules:
- 2D remains precise/editable;
- 2.5D must not fabricate building height/terrain;
- switching views must not mutate project science;
- no cinematic gimmick;
- no fake flood water.

A strong 2D product is preferable to dishonest 2.5D.

## Context map / basemap
A geographic basemap is optional.

Use only if:
- coordinates/georeferencing are real;
- provider/license is compatible;
- offline core still works;
- failure has a graceful fallback;
- alignment is truthful.

Never place schematic geometry on a real map and imply accuracy.

## Reference image
A user-supplied site/photo/plan underlay may be powerful.

If implemented:
- user knows it is a reference layer;
- opacity/lock controls may help;
- no automatic scale assumption unless explicitly calibrated;
- source image never silently becomes scientific measurement.

## Mobile/tablet ambition
Do not simply shrink desktop.

Explore:
- touch-first selection;
- contextual sheets;
- gesture-safe edit modes;
- long-press/context menus;
- floating tool clusters;
- progressive tool visibility;
- mobile-friendly vertex editing.

If full editing is impractical on phone, preserve a useful review/light-edit path rather than a broken mini-desktop.

## Performance
Studio should remain responsive with a realistic project.

Measure:
- pointer/drag latency;
- re-render frequency;
- zoom/pan smoothness;
- label density;
- overlay cost;
- save persistence cost.

Use appropriate spatial/canvas technology based on evidence.

## Scientific honesty firewall
Absolutely do NOT invent:
- GPS;
- scale;
- north;
- elevation;
- slope;
- drainage direction;
- flood depth;
- ponding;
- hydraulic connectivity;
- infiltration;
- capacity;
- cost;
- building heights;
- real-world dimensions
from visual geometry unless the data/contract explicitly supports it.

## Design freedom vs truth
The UI can be visually wild.
The science cannot be.

Be ambitious in:
- composition;
- interaction;
- rendering;
- delight;
- visual storytelling.

Be conservative in:
- scientific claims;
- inferred physical meaning;
- hidden defaults.

## Current implementation reset rule
If a Studio implementation already exists:
1. audit which domain/state pieces are valid;
2. freeze/reuse only those proven contracts;
3. treat current UI/UX as disposable;
4. do not preserve layout due to sunk cost;
5. create fresh concepts;
6. rebuild the presentation/interaction layer if a stronger design requires it.

## Owner checkpoint
Before final Studio art-direction freeze, show:
- at least 2–3 materially different strong concepts, OR
- one clearly superior concept plus evidence explaining why alternatives were rejected.

Use populated realistic states:
- several surface zones;
- selected zone;
- UNKNOWN/missing state;
- rainfall/baseline overlay if supported;
- interventions placed;
- at least one narrower viewport.

The owner is choosing the quality/direction, not dictating implementation details.

## Studio success bar
Studio Persil should be the screen people remember after seeing TIRTA.

It should demonstrate:
- spatial intelligence;
- product clarity;
- scientific honesty;
- direct manipulation;
- visual craft;
- responsive engineering.

If Studio merely looks like “colored rectangles with a form beside them,” keep going.
