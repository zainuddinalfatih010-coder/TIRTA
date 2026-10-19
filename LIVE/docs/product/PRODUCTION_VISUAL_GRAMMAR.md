# Production visual grammar — approved integrated reference

12 September 2026. This extracts the grammar already approved at `4d259d9`; it is not a redesign brief. Parent requirements: C-02, C-04, C-08, C-12 of TIRTA_PRODUCTION_CLOSURE_SPEC.md. Runtime reference: `.design/integrated/screenshots/`; source anchors `src/direction/direction.css`, `Parcel.tsx`, `Visuals.tsx`.

## Reusable foundations

| Role | Production token/grammar | Purpose |
|---|---|---|
| Typography | Locally bundled Manrope, Arial fallback; base14px, body line-height1.5–1.65; annotation13px; h1≈27px/1.25, h2≈18px, h3≈15px; tabular numerals | Calm hierarchy, aligned quantities; never tiny labels to force a layout |
| Spacing | Base4px; use4/8/12/16/24/32/48 for related gaps and section separation; 44px minimum principal controls | Alignment and proximity communicate relationships |
| Paper / working plane | #ffffff / #f7f9f8 | White application field and local spatial depth |
| Text / annotation | #243137 / #5c6970 | Readable primary information and subordinate explanation |
| Hairline / input edge | #e1e6e8 grouping; #aab7be input boundary | Shared surfaces without detached cards; grouping lines are not sole control affordance |
| Selection | #345cbe; double/contrasting boundary, point handles, labelled identity and selected register row | Which object/action is active; blue means selection, not environmental branding |
| Water / infiltration / residual | #16778a / #768849 / #526d7a fill marks plus labelled values | Distinct dispositions in one conserved water partition; fills not automatically safe for small text |
| Reuse (new required semantic) | Related blue water mark with diagonal internal hatch and text “Dimanfaatkan saat kejadian” | Distinguish reused water from remaining storage, no duplicate credit |
| UNKNOWN | Em dash plus “Belum diketahui”, outlined question/info mark, field repair link; use existing muted/amber treatment | Missing value is an actionable state, not0 or predicted uncertainty percentage |
| Warning / infeasible | Amber caution vs red violation, both with cause and margin text | Distinguish incomplete/applicability concerns from a numerical constraint violation |
| Feasible | Check + “Memenuhi batas yang dimasukkan”; green only as small semantic mark | Constraint satisfaction only, never safety/certification |
| Shape/elevation | Inputs radius5px, buttons6px; diagrams/rails share flat surfaces; local shadow only for modal/popover/selection affordance | Object roles differ; no rounded-card universal morphology |
| Icons | Existing Lucide stroke family, typically16–20px; custom tank/resapan/garden/porous domain glyphs follow same stroke scale | Repeated object identity and clear tools; ambiguous actions keep visible labels |

Surface colors and patterns stay stable across editor, legend and contribution graphics: Atap #d8beb3/#815749 roof-line pattern; Beton/Aspal #dfe3e6/#626e76 restrained paving; Tanah terbuka #e4d1af/#806540 earth stipple; Vegetasi #cbd7b5/#586f45 clustered plant texture; Permukaan berpori #c3d4d2/#436f6b perforation pattern. They encode class only, no actual permeability, height, soil type or engineering suitability. Use names/numbers alongside patterns.

Reuse/warning refinements must be contrast-tested against actual runtime backgrounds before production acceptance. They are semantic extensions to the approved system, not a new palette. Source token values are starting implementations; do not keep a demonstrably inaccessible use merely because the color was in the prototype.

## Product visuals inventory

| Visual element | Helps user understand | Accessible equivalent / truth boundary |
|---|---|---|
| Parcel boundary and zone materials | What this parcel contains | Zone list and names; schematic, no metres/north inferred |
| Selection outline, handles, linked row | Which zone is being edited | Announced selected state; keyboard/vertex controls |
| Drawing guides and snap | How sketch geometry aligns | Drawing-coordinate values; no measured dimensions |
| Numbered annotations | Same object across views and dense layouts | Full name in register and accessible label |
| Readiness symbols | Which input is missing | Cause and focusable repair link; not safety status |
| Rain × area micro-equation | Why rain produces this event volume | P/A/units/formula text |
| Zone contribution bars + linked map | Where baseline runoff volume originates | Exact m³, optional percentage with valid denominator; no flow arrows |
| Water-balance rail | Baseline partition into exclusive dispositions | Stored/reused/infiltrated/residual values and equation; zero-state when B=0 |
| Constraint meters and margins | Whether chosen cost/area fits entered limits | Exact use/limit/margin; unknown and zero limits never fake percentages |
| Intervention glyph and target label | What was added and which source supplies it | Explicit target list; placement alone cannot connect water |
| Porous hatch and area label | Proposed treatment location/declared area | Tm² separate from footprint; no measured coverage claim |
| Scenario strips | Current event and comparison context | Scenario name, P/source, changed assumptions |
| Common-scale comparison bars | Relative residual under different events/plans | Table values and deltas; no color-only ranking |
| User-choice check | Which plan the user chose | Text “Dipilih oleh pengguna”; no recommendation crown |
| Provenance icon + disclosure | Where a value came from | Source/method/evidence/applicability text; no trust seal |
| Actual save indicator | Whether local write completed | Saving/Saved/Failed with recovery, no fake cloud |

## Text-to-visual closure

Keep essential text: parameter labels/units, sources, assumptions, error causes, repair actions, claim limits. Convert repeated lists explaining runoff sources into contribution bars; repeated descriptions of intervention outcomes into water partition; cost/space prose into usage/margin rails; scenario summaries into common-scale comparison rows. Method details stay in disclosure and export appendix. Do not remove necessary caveats merely to improve screenshot density.

## Composition and responsive acceptance

Retain approved seven-destination shell, parcel hero and decision hero. Desktop Studio is canvas + linked register with the data bench; mobile keeps parcel visible early, stable selected identity and explicit Data zona jump/sheet. Hujan has the event causal graphic; Intervensi connects footprint and capacity/targets; alternatives are independent choice objects and may use cards; compare and payoff are shared analytical surfaces. No compulsory map on every screen.

Freeze the approved hierarchy, not every pixel width. Use fluid grids and purposeful reflow; no fixed screenshot-only layout, zoom-out, whole-app transform or overflow masking. Test all C-12 viewports and text enlargement. Keep source legend and selected context when charts scroll. Scroll is acceptable when content remains reachable.

## Anti-generic / skill critic decisions

Accepted: shared surfaces, parcel materials, precise local accents, purposeful icons, semantic analytical marks, one focal system per destination. Rejected: new frontend-design art direction, green eco backdrop, generic four-KPI header, global card kit, glass/gradient decoration, decorative motion, BEST/crown. Modified: prototype three-part rail expands to include supported reuse; prototype static area/target labels become domain-backed; native vertex controls supplement pointer gestures. Each modification is required by science or user task, not aesthetic churn.

Runtime parity uses approved screenshots and fresh production evidence after each gate. This document defines future grammar; it does not claim that new production features or added marks have already passed runtime/a11y tests.
