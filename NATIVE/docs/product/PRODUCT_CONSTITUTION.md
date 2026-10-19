# PRODUCT_CONSTITUTION.md

## Product identity
TIRTA — Teknologi Integrasi Resapan, Tampungan, dan Air Hujan — is a parcel/building-scale rainwater pre-planning decision-support application for non-expert users.
Its purpose is to help a user understand a parcel, estimate event rainfall/runoff conditions, explore rainwater interventions, and compare transparent trade-offs before detailed professional engineering.

TIRTA's novelty is not a secret formula. It is the integration of:
- spatial parcel modelling;
- surface classification;
- deterministic event water balance;
- multiple rainfall scenarios;
- intervention planning;
- budget/space/capacity constraints;
- explainable non-dominated alternatives;
- assumptions/provenance;
- offline/local-first operation.

## Primary users
1. School or educational-building managers.
2. Owners/managers of small-to-medium buildings.
3. Community members or early-stage planners who need a structured discussion tool before professional design.

They are not expected to know hydrology terminology before opening the app.
The interface must teach the workflow through the work itself, not through a long manual.

## Core user promise
“Model my parcel, test rain, explore what I can do, and understand the consequences—without hiding assumptions or pretending this is final engineering.”

## Core loop
MODEL -> SIMULATE -> INTERVENE -> COMPARE -> REFINE

A user should be able to revisit any stage, change inputs, and see dependent results become stale/recalculate in an understandable way.
## Stage model
### 1. Persil
Question: “Lahan saya terdiri dari apa saja?”
The user creates/confirms one project parcel, divides it into surface zones, classifies those zones, and supplies measurement/calculation inputs that are actually known.
The product must never require the user to understand internal handoff/canonical/storage architecture.

### 2. Hujan & Kondisi Awal
Question: “Kalau hujan X mm jatuh ke lahan ini, kondisi awalnya bagaimana?”
The user chooses/creates a rainfall scenario, records rainfall depth and source/provenance, resolves missing dependencies, then calculates the event baseline.
The result should connect rainfall -> water volume -> runoff, including contribution by zone where scientifically valid.

### 3. Intervensi
Question: “Apa yang bisa saya lakukan untuk menangani airnya?”
The user composes intervention options manually and/or lets the optimizer evaluate declared options under explicit constraints.
The app communicates capacity, cost, occupied area, and effect without inventing unavailable engineering values.

### 4. Bandingkan
Question: “Apa konsekuensi dan trade-off dari pilihan-pilihan tadi?”
The user compares baseline and multiple alternatives across one or more rainfall scenarios.
The product does not crown an unexplained winner.

Ringkasan/Overview may exist as orientation, readiness, and resume surface. It is not a separate scientific stage.
## Fixed surface taxonomy
Exactly these five surface classes are core:
1. Atap
2. Beton/Aspal
3. Tanah terbuka
4. Vegetasi
5. Permukaan berpori

Surface-class choice must remain visible consistently across Studio, legend, relevant charts, comparison, and provenance.
A class label alone must not silently generate a runoff coefficient.

## Fixed intervention taxonomy
Exactly these four core MVP families:
1. Tangki penampung
2. Sumur resapan / area resapan
3. Rain garden / taman hujan
4. Permukaan berpori

Biopori is not a fifth core intervention. If ever shown, it is educational/non-core and may only use explicit user-entered capacity/assumption semantics.

## Surface Assist
Surface Assist is a narrow image-classification accelerator:
- photo/image input;
- suggested one of the five surface classes;
- confidence shown;
- suggestion status shown;
- user confirm/override required;
- manual path always available;
- low-confidence or model failure never blocks the project.

It is not a chatbot and cannot make engineering decisions.

## Offline promise
Core TIRTA does not need internet to:
- open/save the active project;
- edit parcel/zones;
- create rainfall scenarios;
- run baseline calculations;
- configure interventions;
- run optimizer;
- inspect assumptions/provenance;
- compare results.

Optional sync/hosting may exist later, but failure of a server must not break the demonstration or core calculation.
## Scientific claim boundary
TIRTA must never claim:
- city/area flood prediction;
- flood depth or ponding prediction;
- river/DAS/drainage-network simulation;
- legal/cadastral surveying;
- safety status;
- Zero Delta Q certification;
- compliance certification;
- professional hydrologic/hydraulic/geotechnical/construction design replacement;
- guaranteed field performance.

Outputs are pre-planning estimates from visible inputs and assumptions.

## Truthfulness rules
- UNKNOWN stays UNKNOWN.
- No silent numeric defaults for rainfall, runoff coefficient, capacity, cost, usable area, budget, infiltration performance, reuse demand, or other scientific/engineering quantities.
- Demo values must be labelled SIMULATION / DEMO DATA.
- Assumptions must be visible and traceable.
- User-entered notes/sources remain user-authored; the system must not fabricate source text.
- Spatial appearance must not imply unsupported hydraulic connection, flow direction, depth, elevation, or performance.
- Same valid input must produce the same deterministic output.

## Product quality bar
TIRTA must be:
- understandable by a novice without developer narration;
- visually credible enough for national competition judging;
- spatially coherent;
- scientifically honest;
- responsive/adaptive;
- maintainable;
- testable;
- local-first;
- explainable.

A pretty screenshot with confusing workflow is a failure.
A correct engine hidden behind bad UX is also a failure.
