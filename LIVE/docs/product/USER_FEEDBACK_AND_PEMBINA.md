# USER_FEEDBACK_AND_PEMBINA.md

## Status
HISTORICAL FAILURE / REQUIREMENT EVIDENCE ONLY.

This file exists to stop the greenfield build from repeating old product failures.
It is NOT a visual style guide.
It is NOT permission to copy old layouts, colors, panels, navigation, typography, card treatments, spacing, or screenshots.

For creative authority read CREATIVE_FREEDOM_CHARTER.md.

## How to interpret this file
Every item below should be translated into an OUTCOME requirement.

Example:
- old app had overlapping panels -> new app must be robust responsively.
- old user could not find rainfall input -> new task must be discoverable.
- old Studio felt detached -> new flow must preserve continuity.
- old page had huge dead area -> space must feel intentional.

Do NOT infer:
- inspector must be on the right;
- use a particular palette;
- use a particular shell;
- use cards or avoid cards categorically;
- reproduce Reference-B;
- reproduce any earlier TIRTA visual language.

## P0 historical failure: mental-model fragmentation
The previous implementation could be technically capable while the user still asked:
- after Persil, what am I supposed to do?
- where do I enter rainfall?
- why does Hujan act as if Persil data is missing?
- is the parcel I drew really used by calculation?
- why does opening/editing a parcel feel like another app?
- am I done with this step?
- what do handoff/canonical/provenance/Pareto mean?

This is a severe UX failure.

Greenfield requirement:
a first-time non-technical user should understand the journey without developer narration.

## Internal architecture leaked into the product
Historical implementation exposed concepts such as:
- Ground;
- parcel/bidang;
- zones;
- handoff;
- canonical data;
- separate calculation preparation;
- evidence/provenance internals;
- optimizer technical language.

The architecture may still need sophisticated internals, but normal users should not have to understand those internals to complete work.

## Duplicate source-of-truth failure
At points the old product allowed the same concept to be edited in multiple places.

Example:
- zone name/class in spatial editor;
- similar fields again in calculation preparation.

This caused ambiguity and mental fragmentation.

Greenfield requirement:
every important user concept should have one obvious editing source unless duplication is deliberately synchronized and clearly justified.

## Persil -> Hujan continuity failure
The owner felt that Persil could appear complete while Hujan still behaved as though parcel data was incomplete.

Greenfield requirement:
the relationship from parcel/zones to rainfall/baseline must be visible and behaviorally coherent.

If data is missing:
- say exactly what;
- explain why;
- provide an obvious path to fix it.

## Rainfall discoverability failure
Rainfall input/scenario controls were previously too easy to miss.

Greenfield requirement:
the user should immediately understand how to define the rainfall event being tested.

The agent decides where/how this is presented.

## Giant empty-area failure
Some previous screens contained large blank regions that felt unfinished or meaningless.

Greenfield requirement:
space should feel intentional.
An empty/initial state should explain or enable the next useful action.

The agent decides the visual solution.

## Cramped/overlap failure
Previous iterations suffered:
- text collisions;
- header collisions;
- inspector overlap;
- controls squeezed together;
- content hidden at certain widths.

Greenfield requirement:
true adaptive layout across common desktop/laptop sizes.

Do not fix layout by:
- browser zoom assumptions;
- whole-app transform scale;
- hiding overflow that masks inaccessible content.

No exact layout/panel model is prescribed.

## One-resolution design failure
Some historical fixes worked at one viewport and broke nearby ones.

Greenfield requirement:
test multiple widths during implementation, not only at the end.

## Patch-on-patch CSS failure
Historical work sometimes accumulated increasingly specific overrides.

Greenfield requirement:
fix layout structure and design-system causes rather than stacking brittle exceptions.

## Visual polish before product clarity failure
Some iterations improved aesthetics while the user still did not know what to do.

Greenfield requirement:
visual craft and task clarity must advance together.

A beautiful but confusing result is not accepted.

## Guide-as-crutch failure
A long guide was used to compensate for unclear product flow and itself became cumbersome.

Greenfield requirement:
basic workflow should be understandable from the product itself.
Help remains optional support.

The agent is free to invent any onboarding/help pattern.

## Technical jargon failure
Terms such as:
- canonical;
- spatial handoff;
- provenance snapshot;
- optimizer declared space;
- schema/mismatch codes
were too exposed.

Greenfield requirement:
plain user-facing language first.
Technical detail can remain inspectable behind disclosure.

## Weak spatial experience failure
The owner/pembina wanted Persil to feel like an actual spatial representation rather than a decorative tiny preview or form-only workflow.

Greenfield requirement:
parcel and surface-zone editing must be meaningfully spatial and directly understandable.

HOW that spatial experience works is open.

## Direct manipulation feedback
Pembina feedback supported stronger direct manipulation of zones rather than purely form-driven positioning.

Greenfield requirement:
spatial objects should be practically editable.
The agent may design any interaction model that achieves this cleanly.

## Map/state relationship feedback
Pembina wanted spatial presentation to react meaningfully to selected surface/state rather than remain a static illustration.

Greenfield requirement:
selection/state and relevant visual representation should stay coherent.

No specific map mode or rendering style is prescribed.

## Source/method/limitation feedback
Pembina asked how important values originate and what notes mean.

Greenfield requirement:
important scientific values must have understandable source/assumption traceability.

The agent decides how to surface it.

## Rainfall-source feedback
Pembina asked where rainfall numbers come from.

Greenfield requirement:
rainfall provenance/source cannot be mysterious or silently invented.

## Baseline-method feedback
Pembina expected baseline calculation method to be explainable and checkable.

Greenfield requirement:
the app must make scientific method/results defensible without overwhelming normal users.

## Formal-calculation comparison feedback
The program result needs to be verifiable against independent/manual/reference calculation.

Greenfield requirement:
domain engine and tests must expose inspectable inputs/results and independent validation fixtures.

## Trade-off feedback
Pembina expected the system to find trade-offs, not an opaque recommendation.

Greenfield requirement:
optimizer returns multiple feasible non-dominated alternatives and explains constraints/trade-offs.
No hidden BEST.

## UNKNOWN feedback
UNKNOWN should not be a dead label.

Greenfield requirement:
when unknown data blocks progress, it should be actionable and understandable.

The agent chooses the exact interaction.

## Database/backend feedback
A backend/database was discussed, but the product direction remained offline/local-first.

Greenfield requirement:
no backend dependency for core workflow.

## Save/export feedback
Local save/project continuity matters.

Greenfield requirement:
project state survives reload and can be exported/imported if the chosen release scope includes project-file portability.

## Zoom/spatial-control feedback
Pembina wanted practical navigation of the spatial workspace.

Greenfield requirement:
the user must be able to inspect/edit spatial content comfortably.

No exact zoom buttons/toolbars are prescribed.

## Visualization maturity feedback
The owner/pembina wanted the application to be visually engaging and mature enough that users/judges do not get bored before understanding it.

Greenfield requirement:
use visual storytelling where it improves comprehension.

This does NOT prescribe:
- colors;
- chart type;
- icons;
- animation style;
- layout;
- 3D;
- cards;
- panel placement.

## Observable-progress frustration
The owner strongly dislikes long agent runs that produce little visible product improvement.

Greenfield execution requirement:
at meaningful UI/UX gates, show actual runtime evidence and representative states.
Do not hide behind code volume, documents, or test counts.

## What the owner is explicitly asking now
The owner does NOT want Codex/Antigravity to imitate the previous design direction.

The owner wants:
- the end product requirements to remain clear;
- features/science/usability to remain protected;
- the agents to use their own design intelligence;
- materially different UI/UX concepts to be welcome;
- the final visual direction to be discovered by the agent, then reviewed by the owner.

## Historical design artifacts
Any prior:
- Reference-B visual system;
- pale-blue/navy palette;
- right inspector;
- specific header height;
- large analytical plates;
- specific card philosophy;
- old screenshots;
- old CSS;
- old mobile nav
must NOT be treated as desired output.

If these appear anywhere else in the package, CREATIVE_FREEDOM_CHARTER.md overrides them.

## Owner-review questions
A new design should be evaluated by outcomes:
1. Can I understand what to do without explanation?
2. Does Persil clearly affect Hujan?
3. Can I find and interpret key inputs/results?
4. Does the spatial experience feel useful?
5. Does it survive multiple resolutions?
6. Are uncertainty and source transparent?
7. Does it feel coherent, intentional and competition-ready?
8. Does it feel like an original product rather than a remix of old TIRTA?

The actual visual solution is open.
