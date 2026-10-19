# UX_VISUAL_BLUEPRINT.md

## Status
OUTCOME SPECIFICATION ONLY.

This file does NOT define a visual style.
For creative authority read CREATIVE_FREEDOM_CHARTER.md first.

The coding/design agent is expected to create the actual UI/UX language from scratch.

## Product-story outcome
A non-technical first-time user must understand the TIRTA journey as:

Persil -> Hujan & Kondisi Awal -> Intervensi -> Bandingkan

This is a mental model, not a mandatory navigation component.
The agent may choose any screen structure/navigation model that communicates the story better.

## Required user comprehension
At any meaningful point the user should be able to answer:
- what am I doing?
- why am I doing it?
- what information is required?
- what is currently selected?
- what is missing?
- what changed?
- is this result current or stale?
- where did this important number come from?
- what can I do next?

How the interface achieves this is open.

## Required capability outcomes

### Project orientation
The user can:
- create/open a project;
- understand which project is active;
- understand project completeness/readiness;
- resume meaningful work;
- save locally;
- access assumptions/help/export when relevant.

No specific dashboard, header, rail, or card layout is prescribed.

### Persil
The user can:
- establish a parcel;
- create/edit/delete/select spatial zones;
- classify zones into the five required surface classes;
- understand which object is active;
- supply or resolve calculation-relevant information;
- understand what is visual versus measured/scientific;
- continue naturally toward rainfall/baseline.

The spatial authoring experience should feel real and useful, but its visual language and interaction chrome are open.

### Hujan & Kondisi Awal
The user can:
- create/select/edit rainfall scenarios;
- enter rainfall depth;
- record/inspect its source/status;
- understand missing dependencies from Persil;
- calculate baseline;
- understand event water volume and baseline runoff;
- inspect zone contribution where valid;
- recognize stale results.

The exact visualization is open.

### Intervensi
The user can:
- understand the four intervention families;
- create/edit/remove intervention options;
- provide relevant explicit parameters;
- understand constraints and infeasibility;
- create a manual alternative;
- invoke the optimizer when option space is ready;
- understand what each returned alternative changes.

No prescribed cards, panels, rails, or layout.

### Bandingkan
The user can compare:
- baseline;
- multiple alternatives;
- multiple rainfall scenarios;
- residual runoff;
- cost;
- occupied area;
- relevant storage/reuse/infiltration outcomes;
- assumptions/limitations.

The user should understand trade-offs quickly.
The agent may choose tables, diagrams, bars, spatial comparison, hybrid layouts, or another design as long as comparison remains truthful and legible.

## Progressive disclosure outcome
Normal users should not be forced to parse raw implementation/scientific metadata before completing tasks.

Advanced detail must remain available:
- provenance;
- assumptions;
- formulas/method notes;
- optimizer explanation;
- validation information where useful.

How disclosure works is open.

## Spatial continuity outcome
Persil should not feel disconnected from later analysis.
The product should make it obvious that rainfall/baseline/intervention results derive from the active project parcel/zones.

How continuity is communicated is open.

## Empty-state outcome
Empty states must never feel like broken unfinished space.

They should make clear:
- what is absent;
- why it matters;
- what action can move the user forward.

No specific empty-state visual pattern is prescribed.

## Error-state outcome
When an action cannot proceed, communicate:
- what is wrong;
- why it matters;
- how to fix it;
- where to fix it if the dependency belongs elsewhere.

Avoid cryptic internal codes in the primary UX.

## Stale-result outcome
If upstream scientific inputs change, downstream result status must be understandable.

The user should never unknowingly compare obsolete results.

## Responsive outcome
The product must remain usable across common laptop/desktop sizes and mobile/tablet targets.

Canonical pressure widths include approximately:
- 1920
- 1707
- 1536
- 1440
- 1366
- 1280 px

At 100% browser zoom:
- no accidental page-level horizontal overflow;
- no overlapping primary controls;
- no clipped critical text/input;
- no navigation collision;
- no unusable spatial workspace;
- no hidden required input;
- no need for whole-app transform scaling.

The agent freely chooses breakpoints and responsive composition.

Scrolling is allowed.
Panels may collapse.
Navigation may change form.
Controls may move.
The only requirement is coherent usability.

## Mobile/tablet outcome
Mobile is allowed to be structurally different from desktop.

Required:
- core workflow accessible;
- primary spatial/analytical content usable;
- touch controls usable;
- navigation does not cover critical content;
- context/selection is not needlessly lost;
- safe areas handled;
- no forced desktop miniaturization.

No bottom-nav/sheet requirement is prescribed.

## Accessibility outcome
Target WCAG 2.2 AA where practical.

Required quality includes:
- readable contrast;
- visible focus;
- semantic controls;
- keyboard operation for relevant paths;
- accessible names;
- non-color state cues;
- touch-friendly controls;
- reduced-motion respect;
- no keyboard traps.

How this appears visually is open.

## Visual-quality outcome
The product should feel intentional, coherent and competition-ready.

This does NOT mean conforming to a predetermined style.

The agent should avoid:
- obvious unfinished placeholders;
- random component-library defaults with no system;
- inconsistent visual grammar;
- decorative UI with no purpose;
- misleading visualizations;
- massive accidental whitespace;
- cramped collision-prone composition.

The agent is otherwise free to choose any aesthetic direction.

## Distinctiveness outcome
The owner does NOT want a clone of earlier TIRTA.

A different visual identity is welcome.

The design should be memorable because it is coherent and suited to TIRTA's problem—not because it matches a prior palette/layout.

## Data-visualization truth
Any visual encoding must map to real data/meaning.

Do not imply:
- flood depth;
- flow direction;
- hydraulic connection;
- continuous scientific scales;
- certainty
unless the product actually has validated data for it.

Within those truth constraints, visualization style is completely open.

## Motion outcome
Motion may be used or omitted.

If used:
- it should support feedback/orientation/continuity;
- it must not obscure data;
- it should respect reduced motion;
- it must remain performant.

No motion style/timing system is prescribed.

## Help/onboarding outcome
A user should not need a long guide to understand basic operation.

Contextual help is allowed in any form:
- inline;
- guided;
- tooltip;
- contextual assistant;
- help mode;
- documentation panel;
- another solution.

The agent chooses the design.

## Design process requirement
Before freezing major art direction:
1. understand the product and user;
2. research current high-quality references broadly;
3. create materially different design concepts;
4. test them using real TIRTA content and populated states;
5. explain trade-offs;
6. show the owner actual representative output.

Do not treat old TIRTA visuals as a concept candidate unless the owner explicitly requests it.

## Acceptance
A design passes when:
- first-time workflow is understandable;
- promised capabilities are discoverable;
- important data/uncertainty is interpretable;
- layout survives target viewports;
- accessibility baseline is met;
- product feels coherent and finished;
- the owner accepts the art direction.

How the product looks while satisfying those conditions is intentionally unrestricted.
