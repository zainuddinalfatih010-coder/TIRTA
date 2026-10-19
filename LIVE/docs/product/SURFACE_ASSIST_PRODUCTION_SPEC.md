# Surface Assist — production contract v1

Status: implementation-ready proposal for the pre-production owner gate, 12 September 2026. No final model has been trained, downloaded, installed or evaluated. This document closes the feature's meaning; measured model quality and device performance are later release evidence, not invented facts.

Authority: submitted proposal PDF pp.6, 10, 12–14, 18–19, 22, 24; SCIENCE_AND_DATA_CONTRACT.md; owner closure request §§4–9. Parent contract: [TIRTA_PRODUCTION_CLOSURE_SPEC.md](TIRTA_PRODUCTION_CLOSURE_SPEC.md).

## SA-01 — one job, five labels

For an existing selected zone, classify a user-supplied representative surface photograph into exactly `roof`, `paved`, `soil`, `vegetation`, `porous` (Atap; Beton/Aspal; Tanah terbuka; Vegetasi; Permukaan berpori). It is a convenience for manual input. No segmentation, detection, parcel creation, measured area, geolocation, engineering interpretation or autonomous eligibility decision.

The canonical class changes only through an explicit user action. Nothing in this feature writes area, polygon, dimensions, C, infiltration, soil, slope, elevation, capacity, cost or intervention eligibility. Class changes invalidate dependent target checks; they do not supply a conclusion to those checks. A confirmed class does not automatically determine C.

## SA-02 — UX and state machine

In the existing selected-zone property bench, retain the normal labelled class select and add **Kenali dari foto**. Manual entry is always the first available path; no model loading is needed to open Studio or select a class.

| State | Visible interaction | Canonical mutation / recovery |
|---|---|---|
| No selected zone | Explain “Pilih zona terlebih dahulu” | No launch and no photo stored |
| Ready | Zone name/number, manual select, camera/gallery actions | Opening Assist does not change class |
| Choosing image | Native camera or file picker; cancel | Cancel returns to the same zone |
| Image ready | Local preview of the exact square crop, replace photo, **Analisis foto** | No inference before explicit action; no full-site analysis |
| Loading/running | “Memproses di perangkat”; cancel remains operable | One request at a time, manual path remains usable |
| Valid suggestion | Suggested label plus five labelled probability bars, percentage and confidence explanation | **Gunakan [kelas]** or **Pilih kelas lain**; never auto-commit |
| Low confidence | “Foto belum cukup jelas untuk memberi saran kuat.”; five-class distribution in disclosure | **Ambil foto lain** / **Pilih manual**; no one-click strong-suggestion treatment |
| Unsupported/corrupt photo | Plain error, accepted format/size guidance | Replace image or manual |
| Model absent/fails/timeout | “Surface Assist tidak tersedia. Anda tetap bisa memilih permukaan secara manual.” | No project blocker, no fake percentage |
| Confirmed/corrected | Canonical label and source summary | One atomic history command; undo restores prior class and provenance |

Use a native modal dialog on desktop and the same accessible dialog semantics with a responsive sheet on phone. Focus begins at its heading/image action; Escape/cancel closes; focus returns to the launching control. Explicit confirm is required even at 100% classifier confidence. Prediction is a live polite status once, not five repeated announcements. Bar labels expose all five values in text. Low confidence is not color-only. No automatic camera permission request on app startup.

Request context is `(projectId, zoneId, zoneRevision, requestId, modelDigest, imageSessionToken)`. Cancel, zone selection change, project switch, manual class edit, deletion or newer request invalidates it. Late results are discarded, not applied to whichever zone is now selected. Android activity restoration requires reselecting/confirming the intended zone; it must never auto-apply a recovered prediction.

## SA-03 — exact persisted record

Classification is a categorical provenance record separate from numeric `Parameter`. Canonical zone class and active classification record update in the same transaction. IDs are strings; `Surface` is the exact five-value enum. No device/user identity is required.

```ts
type ClassificationRecord = {
  id: string;
  zoneId: string;
  revision: number;                    // positive integer
  predecessorId: string | null;
  origin: 'manual' | 'surface-assist';
  evidenceClass: 'USER_INPUT';        // final label is user confirmed, not measured
  state: 'confirmed' | 'corrected';
  confirmedClass: Surface;
  correctedClass: Surface | null;
  prediction: null | {
    evidenceClass: 'ASSIST_SUGGESTION';
    predictedClass: Surface;
    probabilities: [number, number, number, number, number];
    confidence: number;
    modelId: string;
    modelVersion: string;
    modelSha256: string;
    preprocessingVersion: string;
    calibrationVersion: string | null;
    thresholdPolicyVersion: string;
  };
  note: string;
};
```

Invariants: probability order is always roof/paved/soil/vegetation/porous; values finite in [0,1], sum within 1e-6 of 1; confidence equals maximum; predictedClass is argmax with fixed label-order ties. Missing/malformed outputs reject, never renormalize arbitrary malformed output into apparently valid inference. Manual record: prediction=null, state=confirmed, correctedClass=null. Accepted prediction: final=predicted, state=confirmed, correctedClass=null. Override: final differs from predicted, state=corrected, correctedClass=confirmedClass. Low-confidence manual choice after seeing a prediction retains the prediction and follows these same equality rules. Dismissed/unconfirmed predictions are transient and never canonical.

UI examples: “Surface Assist · 86% keyakinan model · dikonfirmasi pengguna”; correction: “Dikoreksi pengguna dari saran Vegetasi”. Percent describes classifier output, not engineering/runoff/infiltration certainty. Display rounds only; full distribution is retained. Manual edits after confirmation append a new manual record; prior result is history, never presented as the current prediction.

No inference timestamp is required: request IDs and revisions establish freshness; deterministic science does not use wall time. Project save/update timestamps are local lifecycle metadata only. Raw EXIF, GPS, face identity, original filename, photo hash and raw image are absent from this record. Historical records are bounded by project revision retention; backup retains current record and referenced predecessor records still present, never invents missing history.

The type above describes actual user classification, not synthetic fixture seeding. Explicit demo loading may instead create the separate strict record `{id,zoneId,revision,origin:'demo',evidenceClass:'DEMO',state:'fixture',class:Surface,source:string}`; it has no prediction/confidence or claim of user confirmation. Such records are valid only in demo projects and cannot be migrated to USER_INPUT automatically. First actual manual/Assist confirmation appends the user record above. A legacy v1 label with no source retains a null classificationRecordId and needs reconfirmation; it is not silently assigned a fabricated classification history.

## SA-04 — model interface and image path

Adapter contract: `load(manifest)`, `predict({requestContext, pixels}) -> Outcome<Prediction>`, `cancel(requestId)`, `dispose()`. Expected failures use stable codes: MODEL_UNAVAILABLE, MODEL_INTEGRITY, UNSUPPORTED_IMAGE, IMAGE_TOO_LARGE, IMAGE_DECODE, INFERENCE_TIMEOUT, BAD_OUTPUT, STALE_REQUEST. Only successful current predictions reach the review UI. Runtime execution provider is diagnostic metadata; it does not change label meaning.

Model manifest must pin artifact SHA-256, label order, input/output tensor names/shapes/dtypes, preprocessing version, normalization, output kind (logits or probabilities), calibration parameters and threshold policy, runtime compatibility, model/dataset licences, evaluation-report identity and measured device support. No “latest” URL or automatic provider model swap.

Proposed image path: one JPEG/PNG/WebP, MIME plus decode validation, at most 10 MiB encoded and 24 megapixels decoded (engineering guards, not science). Inspect dimensions before large decode where supported; reject unsupported safely. Correct EXIF orientation once, strip metadata, let user inspect a center-square crop (replace/reframe without inferring a zone boundary), bilinear resize to 224×224 RGB, float32 normalization exactly matching the training/export manifest. Export recommended backbone with preprocessing explicit; never normalize twice. Fixed square crop can miss relevant context: user preview and recapture are required mitigations.

The app performs softmax once if manifest output is logits, using numerically stable exponentiation. Any calibrated temperature is applied to logits exactly once and is fitted on validation data only. Provider outputs must pass golden-image comparison to the reference runtime before release. Classification may differ numerically across hardware; determinism of the water-balance engine relies on the confirmed label and numeric inputs, not bitwise identity of ML execution.

## SA-05 — realistic implementation recommendation

Choose **MobileNetV3-Small with a five-class fine-tuned head exported to ONNX, ONNX Runtime Web WASM in a dedicated worker**, shared between React browser and Capacitor Android WebView. This is a engineering recommendation, not a measured compatibility claim. Start with one WASM thread for portability; ship matching JS/WASM/model files locally and verify hashes. Instantiate lazily, one session, release tensors after each request and terminate/recreate the worker after cancel/timeout as needed.

| Option | Fit | Cost / decision |
|---|---|---|
| ONNX Runtime Web / WASM | One browser/WebView adapter, CPU fallback, bundled offline files | Recommended first. Operator/export and WebView compatibility must be tested |
| TF.js / WASM or WebGL | Viable MobileNet transfer-learning ecosystem, browser execution | Alternative if ONNX export/operator parity fails. Avoid maintaining both runtimes in release |
| Native ONNX Runtime Mobile or LiteRT/TFLite through Capacitor plugin | Potentially better Android performance / acceleration | Conditional fallback only after measured WebView failure; adds Kotlin bridge, build/ABI and parity tests |
| WebGPU | Possible acceleration | Optional future optimization after device measurements; not required for core support |
| Cloud/LLM/segmentation | Adds network, scope and ambiguity | Rejected |

Official ONNX guidance covers offline web execution and WASM; deploy requires matched runtime assets and model files. Its thread guidance permits forcing one thread. These capabilities support the recommendation, not a latency promise. [Web inference](https://onnxruntime.ai/docs/tutorials/web/), [deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html), [thread configuration](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).

MobileNetV3-Small's documented full architecture is about 2.9 million parameters; a five-class export has a different head. Rough FP32 weight arithmetic is about 12 MB before graph/packaging, not final download/RAM size. TF documents normalization differences depending on embedded preprocessing. [Backbone and preprocessing](https://www.tensorflow.org/api_docs/python/tf/keras/applications/MobileNetV3Small). TF.js provides an alternative runtime/backend strategy and transfer-learning workflow. [TF.js platforms](https://www.tensorflow.org/js/guide/platform_environment), [transfer learning](https://www.tensorflow.org/js/tutorials/transfer/image_classification). Native fallback is technically available but not a drop-in Capacitor API. [ONNX mobile](https://onnxruntime.ai/docs/tutorials/mobile/).

Engineering targets, **unmeasured**: model ≤15 MiB FP32, model+runtime deployment budget ≤40 MiB, incremental peak inference memory target ≤150 MiB, warm p95 ≤2 seconds, cold local load+inference p95 ≤5 seconds on the release Android test device. Guard operation at 15 seconds with manual fallback, never endless spinner. 224×224×3 float32 input alone is 602,112 bytes; decoded photos/activations/runtime dominate memory. Measure actual encoded bundle, process/worker memory and UI long tasks; don't infer RAM from model weight size. INT8 is considered only if parity/calibration and weak-class results survive conversion. No training on the owner's laptop or new dependency installation in this gate.

Capacitor camera remains optional; use gallery/file picker as fallback. Pin the chosen API version at implementation because current docs include both newer media methods and legacy getPhoto. Camera capture may outlive the app activity; handle restoration without guessing the target. Disable gallery saving and permanent evidence retention. [Official camera lifecycle/API](https://capacitorjs.com/docs/apis/camera).

## SA-06 — confidence and evaluation policy

No production threshold is asserted valid before data exists. Start evaluation with candidate gates top probability ≥0.75 and top-two margin ≥0.15; these are **validation hypotheses only**, never claims of accuracy. Select and freeze the operating thresholds using validation results before opening held-out tests. Until an approved manifest includes a validated threshold policy, show manual-only/unavailable in production, not a synthetic classifier.

Initial acceptance target (product criterion, not achieved result): held-out suggested-and-accepted-eligible subset precision ≥0.80 for each class with at least 20 qualifying test examples per class. Report uncertainty intervals and class counts; insufficient support fails the claim. Also require overall suggestion coverage ≥50% on the in-domain held-out set so abstaining on everything cannot pass. If these cannot both be met, report failure, improve data/model and retest against a new untouched test set; do not lower thresholds after inspecting the same held-out errors. Manual functionality remains deliverable but a missing defensible model remains a proposal feature gap requiring explicit release disclosure/owner decision.

Pilot dataset plan (collection targets, not existing data): start at ≥200 independent labelled images/class (≥1,000 total) across physical surfaces and capture sessions, aiming for ≥20 distinct physical surface instances/class. A near-duplicate burst is one group, not many independent samples. Include the school pilot as a separately identified evaluation stratum. If representative roof/porous ground truth cannot be collected, record insufficient data; no stock texture substitutes disguised as pilot.

- Split by physical surface/site and capture session before augmentation: 60% train, 20% validation, 20% frozen held-out, approximate class balance. Entire physical surfaces stay in one split across sessions/crops/devices. Hold out a site when collection permits; retain group IDs and split manifest digest. Pilot photos used for training cannot also support a pilot test claim.
- Collect lighting/shadow, wet/dry appearances, weathering, viewing angle, distance, device/camera, vegetation variety and paving/roof materials. Include misleading porous-looking concrete. No inference of porosity from texture alone: confirm material labels through owner/site records, and mark ambiguous specimens for adjudication/exclusion rather than forced labels.
- Define labelling guide: roof by structural use, paved by verified concrete/asphalt, soil exposed earth, vegetation visible plant cover, porous by documented permeable material. Two reviewers label held-out photos independently; disagreements adjudicated and recorded. Mixed/ambiguous images form a separate challenge set; abstention is an outcome, not a sixth class.
- Training: freeze pretrained backbone initially, train five-class head, fine-tune limited layers if validation supports it. Augment training only. Track source/licence/consent, group/split, class, camera variation, duplicates and exclusions. No covert collection or user-photo uploads.
- Report full 5×5 confusion matrix for top-1 predictions, per-class precision/recall/F1 and support, macro F1, balanced accuracy, overall accuracy supplemental, and confidence/reliability plot. Separately report accepted-suggestion confusion, coverage and error, low-confidence/failed-inference/manual-override rates. Precision with zero predicted positives is undefined, not 100%.
- Use validation-only temperature scaling if data supports it; evaluate ECE/Brier and reliability plots on held-out data, preserve uncalibrated comparisons. Calibration on small samples is uncertain. [Temperature-scaling research](https://proceedings.mlr.press/v70/guo17a.html).
- Freeze test before model selection. All later tuning requires a new untouched final test or transparent development-only status. Report model digest, preprocessing, runtime/provider, device, dataset/split versions and intervals alongside metrics. Do not equate ImageNet accuracy or the interface's 86% illustration with TIRTA test performance.

## SA-07 — storage and offline

Raw photo and crop stay in session memory/temporary app cache. Revoke object URLs, free pixel buffers and delete only app-owned temporary files on cancel/finish/next launch cleanup. Do not delete the user's gallery originals. No raw image in project JSON, analytics, logs or classifier provenance. No background upload. Optional evidence-photo attachment is a separate future opt-in feature, not required for classification or this release.

Model/runtime assets ship in the APK and validated web offline asset set. Model-load failure leaves manual classification fully usable. Updating a model never changes previously confirmed labels. Project underlay is a different feature with its own explicit attachment policy; it is not sent to Assist automatically.

## SA-08 — acceptance cases

SA-T01: all five output mappings + malformed tensor/probability rejection; fixed preprocessing golden pixels and reference image vectors. SA-T02: no canonical mutation before confirm, override history, undo and manual-only offline. SA-T03: C/area/geometry/capacity/cost byte-identical before and after confirmation. SA-T04: low confidence, no model, timeout, corrupt image, oversize image, permission denial and picker cancellation recover without blocking. SA-T05: out-of-order responses, changed/deleted zone/project, manual edit during inference and Android restoration cannot apply stale output. SA-T06: saved final labels/provenance survive both storage adapters; photos/EXIF absent from backups. SA-T07: cold offline model load on browser and physical Android, memory/latency report, UI remains usable, cancel effective. SA-T08: frozen labelled evaluation and licensing report. SA-T09: keyboard dialog flow, TalkBack/desktop screen-reader names, touch controls, 320px reflow and no color-only probability meaning.

The contract is closed when these behaviors can be implemented without inventing feature meaning. The model is accepted only after the later measured gates pass.
