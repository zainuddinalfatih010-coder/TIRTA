# TIRTA SCIENTIFIC REVISION — MASTER PRD

## 1. Tujuan

Melakukan perombakan ilmiah dan decision-support TIRTA tanpa menghancurkan fondasi aplikasi yang sudah bekerja.

TIRTA tetap merupakan:

**Teknologi Integrasi Resapan, Tampungan, dan Air Hujan**

dan tetap berfungsi sebagai:

**alat bantu keputusan pra-perencanaan pengelolaan air hujan skala persil.**

TIRTA tidak berubah menjadi:

- simulator banjir;
- model hidraulik jaringan;
- SWMM replacement;
- sistem sertifikasi konstruksi;
- GIS/cadastral tool;
- AI yang menentukan keputusan pengguna;
- alat yang mengklaim prediksi genangan;
- alat yang mengubah asumsi menjadi fakta.

Core flow tetap dipertahankan:

**Persil → Hujan → Kondisi Awal/Limpasan → Intervensi → Alternatif → Bandingkan → Pilih Rencana**

Evaluasi lapangan ditambahkan sebagai workflow setelah rencana, bukan mengganti core flow.

---

# 2. Problem Statement

Audit terhadap build TIRTA yang sekarang serta catatan pembina menunjukkan beberapa gap:

1. Lima jenis permukaan masih terlalu umum untuk menjelaskan kondisi lapangan.
2. Atap belum menyimpan karakteristik bentuk/aliran keluaran air.
3. Tanah belum menyimpan kondisi yang relevan terhadap infiltrasi.
4. Vegetasi belum memiliki karakteristik tutupan.
5. Permukaan berpori kondisi awal dan intervensi baru belum cukup dibedakan.
6. Hujan masih terutama direpresentasikan oleh depth tanpa konteks durasi.
7. Beberapa output debit/waktu berisiko memberi precision yang tidak didukung data.
8. Kelayakan intervensi belum memiliki hard feasibility gates yang cukup.
9. Dasar ilmiah ada tetapi belum menjadi evidence system yang terhubung ke setiap claim/rule.
10. Belum ada workflow evaluasi implementasi di lapangan.
11. User masih dapat melihat rekomendasi tanpa selalu memahami apa yang diketahui, diasumsikan, atau belum diketahui.

Perombakan ini harus menyelesaikan gap tersebut tanpa overclaim.

---

# 3. Scientific Architecture

Arsitektur ilmiah TIRTA menggunakan:

**Evidence-Constrained Parcel Water Balance + Feasibility Screening + Deterministic Pareto Decision Support**

Urutan proses:

**Field observations**
→ **surface characterization**
→ **rainfall event**
→ **volume balance**
→ **source/flow relationships**
→ **intervention feasibility**
→ **transparent intervention calculation**
→ **finite alternative generation**
→ **hard constraint filtering**
→ **Pareto comparison**
→ **human selection**
→ **field evaluation**

Tidak ada hidden scoring.

Tidak ada AI decision logic.

Tidak ada probabilistic winner.

---

# 4. Scientific Invariants

Aturan berikut tidak boleh dilanggar oleh implementasi.

## 4.1 Conservation

Untuk setiap event:

`rainfall_volume_m3 = area_m2 × rainfall_mm / 1000`

Untuk sebuah surface zone:

`runoff_volume_m3 = area_m2 × rainfall_mm / 1000 × C`

Neraca harus selalu memenuhi:

`rainfall volume = runoff + non-runoff`

dalam batas floating-point tolerance yang didefinisikan.

**Non-runoff tidak boleh dilabel otomatis sebagai infiltration.**

Non-runoff dapat mencakup abstraksi, storage, wetting, infiltration, dan mekanisme lain yang tidak dimodelkan secara terpisah.

---

## 4.2 Unknown Is Data

`UNKNOWN` adalah nilai yang valid.

UNKNOWN tidak boleh otomatis:

- menjadi 0;
- menjadi default ilmiah;
- mengambil median literature;
- mengambil nilai permukaan paling mirip;
- dianggap aman;
- dianggap memenuhi feasibility.

Unknown harus tetap terlihat oleh user dan memengaruhi certainty/feasibility secara eksplisit.

---

## 4.3 Provenance

Setiap angka yang memengaruhi keputusan harus mempunyai asal:

- `measured`
- `user_supplied`
- `literature_guidance`
- `derived`
- `legacy_fixture`
- `unknown`

Tidak boleh ada default numerik tersembunyi.

---

# 5. Surface Model

Tetap tepat lima kelas permukaan:

1. Atap
2. Beton/Aspal
3. Tanah Terbuka
4. Vegetasi
5. Permukaan Berpori

Tidak boleh memecah lima kelas tersebut menjadi puluhan surface classes.

Karakter tambahan dibuat sebagai metadata.

---

# 6. Atap

Tambahkan metadata opsional:

### Roof form
- flat
- sloped
- mixed
- unknown

### Roof material
- optional free/select value
- unknown allowed

### Runoff outlet mode
- gutter/downpipe
- edge discharge
- connected drain
- mixed
- unknown

### Connected destination
- intervention
- another zone
- site drainage
- outside modeled parcel
- unknown

Bentuk atau material atap **tidak boleh secara otomatis mengganti runoff coefficient** kecuali ada explicit user selection dan provenance yang sah.

Tujuan utama fitur ini adalah menjelaskan jalur air dan kelayakan intervensi seperti rainwater tank.

---

# 7. Beton/Aspal

Beton/Aspal tetap satu surface family.

Metadata opsional:

- material subtype jika diketahui;
- surface condition;
- crack/joint information bila relevan;
- coefficient provenance.

Surface Assist dari foto hanya boleh menghasilkan suggestion.

Hasil recognition tidak pernah menjadi canonical surface class sebelum user mengonfirmasi.

---

# 8. Tanah

Metadata opsional:

### Soil description
- sandy tendency
- loamy tendency
- clayey tendency
- mixed
- unknown

### Compaction
- loose
- moderate
- compacted
- unknown

### Field infiltration/permeability evidence
- optional measured value;
- measurement unit;
- measurement method;
- measurement date;
- provenance.

TIRTA tidak boleh menyimpulkan kapasitas infiltrasi numerik hanya dari nama jenis tanah.

---

# 9. Vegetasi

Tetap satu surface family.

Metadata opsional:

- grass-dominant
- shrub-dominant
- tree-dominant
- mixed
- unknown

Tambahkan kondisi tanah di bawah vegetasi jika diketahui.

Vegetation subtype memberi konteks, bukan angka infiltrasi otomatis.

---

# 10. Permukaan Berpori

Harus dibedakan secara domain dan UI antara:

## Existing porous surface

Permukaan berpori yang sudah ada pada baseline.

dan

## Proposed porous conversion

Intervensi untuk mengubah sebagian permukaan existing non-porous menjadi porous surface.

Proposed porous conversion wajib memiliki:

- target zone;
- converted area;
- proposed system/material;
- supporting specification;
- performance provenance;
- status feasibility.

Metadata teknis opsional:

- surface material/system;
- surface layer;
- base/sub-base;
- subgrade condition;
- measured/design infiltration information;
- age/maintenance state untuk existing installation;
- unknown allowed.

Tidak boleh menghitung baseline porous benefit lalu mengurangi runoff kedua kalinya sebagai intervention benefit.

**No double counting.**

---

# 11. Rainfall Event Model

Field wajib:

`depth_mm`

Field opsional:

`duration_minutes`

Jika duration tersedia:

`average_intensity_mm_h = depth_mm / duration_hours`

Label wajib:

**intensitas rata-rata kejadian**

bukan peak intensity.

Depth tetap menjadi input utama volume ledger.

Tanpa duration:

- volume calculation tetap boleh berjalan;
- average intensity tidak tersedia;
- flow-rate claim tidak boleh dibuat.

TIRTA tidak boleh menghasilkan `L/s`, peak discharge, hydrograph, atau timing claim hanya berdasarkan rainfall depth.

---

# 12. Source / Flow Relationship

Tambahkan lightweight source-routing graph.

Tujuannya bukan hydraulic simulation.

Graph hanya merepresentasikan hubungan konseptual:

`source → destination`

Contoh:

Atap Gedung A
→ downpipe
→ Tangki A

atau:

Atap Gedung A
→ edge discharge
→ Halaman Beton

Allowed destinations:

- zone;
- intervention;
- drainage;
- outside parcel;
- unknown.

Graph dipakai untuk menentukan apakah sebuah intervention benar-benar dapat menerima runoff dari sumber tertentu.

---

# 13. Intervention Families

Tetap hanya empat:

1. Tangki
2. Sumur / area resapan
3. Rain garden
4. Permukaan berpori

Jangan menambah intervention family baru tanpa revisi PRD.

---

# 14. Feasibility Engine

Intervention tidak boleh diperlakukan hanya sebagai icon + capacity.

Setiap proposal menghasilkan salah satu status:

- `FEASIBLE_PRELIMINARY`
- `FEASIBLE_WITH_CONDITIONS`
- `MORE_DATA_REQUIRED`
- `INFEASIBLE_WITH_AVAILABLE_DATA`

Tidak menggunakan skor angka feasibility.

Setiap status harus memiliki:

- reasons;
- missing data;
- evidence IDs;
- required field verification.

---

# 15. Tangki Feasibility

Periksa minimal:

- sumber runoff tersedia;
- source benar-benar connected;
- capacity tersedia;
- available storage diketahui;
- lokasi/lahan sesuai;
- budget sesuai.

Volume event yang dapat ditangani tidak boleh melebihi:

- connected runoff volume;
- available tank storage.

Overflow harus memiliki destination atau UNKNOWN.

---

# 16. Sumur / Area Resapan Feasibility

Tidak boleh direkomendasikan sebagai fully feasible hanya dari luas lahan.

Critical evidence:

- soil permeability/infiltration information;
- groundwater condition/depth bila relevan;
- available land;
- target runoff source;
- local standard constraints.

Jika data hydrogeological penting tidak tersedia:

**MORE_DATA_REQUIRED**

bukan asumsi.

SNI 8456:2017 diperlakukan sebagai authoritative local technical source terpisah dari jurnal ilmiah.

Persyaratan numerik SNI hanya boleh di-hard-code bila diperoleh dari sumber resmi/legal dan telah diverifikasi.

---

# 17. Rain Garden Feasibility

Pertimbangkan:

- target runoff source;
- available area;
- soil/media information;
- infiltration context;
- vegetation;
- internal layer configuration jika diketahui;
- overflow path;
- budget.

Jika desain media/lapisan belum tersedia, TIRTA boleh melakukan early-stage suitability screening tetapi tidak mengklaim final construction performance.

---

# 18. Porous Conversion Feasibility

Wajib memiliki:

- impervious target zone;
- conversion area > 0;
- conversion area ≤ target zone area;
- system specification;
- evidence/provenance untuk model performance yang digunakan;
- subgrade condition jika performance bergantung padanya.

Jika angka performance tidak memiliki basis:

jangan membuat reduction estimate numerik.

---

# 19. Intervention Performance Representation

Semua performance value harus diklasifikasi:

- measured;
- design-declared;
- literature-guided;
- user-entered;
- unknown.

TIRTA tidak boleh menyamarkan literature range menjadi site-specific performance.

Jika sebuah calculation membutuhkan parameter unknown:

hasil yang bergantung pada parameter tersebut harus diblok atau dilabel tidak dapat dihitung.

---

# 20. Alternative Generation

Algorithm:

1. Build declared intervention candidates.
2. Reject scientifically incomplete candidates.
3. Reject physically infeasible candidates.
4. Reject budget violations.
5. Reject land violations.
6. Enumerate finite combinations.
7. Compute event-volume consequences deterministically.
8. Enforce conservation.
9. Remove dominated alternatives.
10. Present Pareto alternatives.

Tidak ada:

- weighted hidden score;
- AI rank;
- best badge;
- automatic winner.

---

# 21. Comparison Dimensions

Minimal:

- intervention composition;
- cost;
- land required;
- residual runoff by rainfall scenario;
- handled volume;
- feasibility status;
- missing/uncertain evidence;
- source connectivity;
- supporting evidence.

Jika user membuat target tertentu, TIRTA boleh menunjukkan:

`meets target / does not meet target / cannot evaluate`

tetapi tidak memberi overall score.

---

# 22. Evidence Registry

Buat canonical evidence registry.

Minimum:

**20 peer-reviewed journal sources.**

Target release:

**20 core + ≥5 reserve sources.**

Conference proceeding tidak dihitung sebagai core minimum.

Tambahkan authoritative local standards di registry terpisah.

Setiap evidence record menyimpan:

- source ID;
- authors;
- year;
- title;
- journal;
- DOI;
- study type;
- geography;
- climate/context;
- interventions/surfaces studied;
- claims supported;
- limitations;
- local relevance;
- evidence category.

---

# 23. Evidence Coverage Requirements

Evidence library harus mencakup minimal:

### Surface/runoff
- roof;
- concrete/asphalt;
- soil;
- vegetation;
- porous surfaces.

### Rainfall
- depth;
- intensity;
- event pattern/duration;
- limitation of volumetric models.

### Intervention
- tank/rainwater harvesting;
- infiltration wells;
- rain gardens/bioretention;
- permeable pavement.

### Context
- Indonesia/tropical applicability;
- site-specific constraints.

### Decision support
- multi-objective/Pareto decision making.

### Validation
- post-construction monitoring;
- before/after evaluation;
- maintenance/performance change.

Satu jurnal dapat mendukung lebih dari satu category.

---

# 24. Claim Registry

Buat claim registry terpisah.

Contoh:

`CLAIM-SOIL-001`

“Physical condition and hydraulic properties of urban soil influence infiltration behaviour.”

Fields:

- claim ID;
- wording;
- scope;
- evidence IDs;
- limitations;
- UI locations that display/use this claim.

Setiap rule penting pada feasibility engine harus dapat dilacak ke claim/evidence.

---

# 25. Evidence UI

Jangan membanjiri user dengan bibliografi di setiap screen.

Gunakan progressive disclosure.

Contoh:

**Mengapa data ini diperlukan?**

→ membuka penjelasan pendek.

**Dasar ilmiah**

→ membuka source summary.

**Lihat penelitian**

→ daftar sumber lengkap.

UI harus dapat membedakan:

- fakta input user;
- nilai hitungan;
- literature guidance;
- assumption;
- unknown.

---

# 26. Field Evaluation

Tambahkan workflow setelah selected plan.

Bukan core calculation stage.

Data:

### Event
- observation date;
- rainfall depth jika diketahui;
- duration jika diketahui;
- rainfall source.

### Before
- observed ponding;
- ponding locations;
- duration if observed;
- photo/note.

### After
- same fields.

### Intervention condition
- installed as planned?
- maintenance condition;
- obvious damage/clogging;
- notes.

Possible result wording:

- **Indikasi lapangan membaik**
- **Belum cukup bukti untuk menilai**
- **Perlu evaluasi ulang**

Dilarang menghasilkan:

- “TIRTA terbukti berhasil”
- “Intervensi terbukti menyebabkan hilangnya banjir”
- “Model tervalidasi”

hanya dari satu before/after observation.

---

# 27. Maintenance Awareness

Intervention yang performanya dapat berubah terhadap waktu harus memungkinkan maintenance context.

Terutama porous pavement:

- installation age;
- maintenance history;
- observed clogging;
- condition unknown.

Ini tidak perlu menjadi maintenance-management product.

Hanya cukup untuk mencegah TIRTA menganggap installed performance statis selamanya.

---

# 28. UX Requirements

Current visual identity dan core layout adalah constraint.

Perombakan ilmiah **bukan alasan untuk redesign total**.

Dilarang:

- generic SaaS card cemetery;
- memenuhi layar dengan nested cards;
- dashboardisasi setiap data;
- random charts;
- fake precision;
- istilah engineering tanpa penjelasan;
- memaksa semua advanced fields terlihat sejak awal.

Gunakan progressive disclosure:

**simple first → detail when needed**

User pemula harus tetap dapat menyelesaikan baseline volume workflow hanya dengan:

- geometry;
- five surface classes;
- coefficients yang dia pilih;
- rainfall depth.

Advanced scientific metadata harus muncul ketika:

- user membutuhkannya;
- sebuah intervention membutuhkan data tersebut;
- user ingin memperkuat evidence.

---

# 29. Migration

Existing project data tidak boleh rusak.

Tambahkan explicit schema version.

Migration rules:

1. Existing five surface classes tetap sama.
2. Existing C values dipertahankan.
3. New metadata default ke UNKNOWN, bukan guessed value.
4. Existing rainfall depth tetap valid.
5. Existing results tidak berubah hanya karena metadata baru ditambahkan.
6. Existing interventions tidak dihapus.
7. Legacy intervention yang belum memenuhi feasibility baru diberi:
   `needs verification`
   tanpa silently modifying input.
8. Existing backups/import/export harus tetap dapat round-trip.
9. Migration harus deterministic.
10. Backup sebelum destructive schema migration.

---

# 30. Demo Data

Demo data harus jelas:

**synthetic/demo**, bukan hasil ukur sekolah.

Demo harus sengaja mencakup:

- known data;
- unknown data;
- intervention feasible;
- intervention conditional;
- intervention blocked by missing information.

Tujuannya agar UI menunjukkan bagaimana uncertainty bekerja.

---

# 31. Export

Plan/report export harus mencantumkan:

- parcel inputs;
- rainfall scenarios;
- surface coefficients;
- provenance;
- intervention parameters;
- feasibility results;
- selected alternative;
- residual runoff;
- known assumptions;
- unknowns;
- evidence references;
- field verification requirements.

Tidak boleh menghapus uncertainty hanya agar report terlihat bersih.

---

# 32. Automated Scientific Tests

Mandatory tests mencakup:

### Conservation
Rainfall volume = runoff + non-runoff.

### Unit conversion
1 mm on 1 m² = 1 L.

### Unknown propagation
Unknown tidak berubah menjadi zero/default.

### Determinism
Identical input → identical results.

### Baseline parity
Capture current authoritative golden fixtures before implementation.
Existing baseline outputs harus tetap identik kecuali ada approved intentional change.

### Rainfall
No duration → no intensity/time-dependent output.

### Connectivity
Tank cannot handle runoff from unconnected roof.

### Porous conversion
Conversion area cannot exceed target area.

No porous double counting.

### Feasibility
Missing critical infiltration-well evidence → MORE_DATA_REQUIRED.

### Alternative filtering
Scientifically incomplete intervention tidak masuk feasible alternative set.

### Pareto
Dominated alternatives tersaring deterministically.

### Migration
Old project → migrate → serialize → reload tanpa data loss.

### Evidence
Every decision rule references valid claim/evidence IDs.

---

# 33. UI / Interaction Tests

Test minimal:

- mouse;
- keyboard;
- Escape;
- modal close X;
- backdrop;
- form validation;
- UNKNOWN states;
- responsive desktop/mobile;
- long evidence title;
- empty evidence state;
- import legacy project;
- export selected plan;
- field evaluation workflow.

No console errors.

No clipped text.

No hidden critical warnings.

---

# 34. Manual Scientific QA

Sebelum release lakukan review manusia terhadap:

1. Every displayed scientific claim.
2. Every numerical default.
3. Every coefficient guidance.
4. Every intervention feasibility condition.
5. Every citation.
6. Every “why this intervention” explanation.
7. Every limitation statement.

Question:

**Can this claim be traced to input, calculation, standard, or journal?**

Jika tidak:

hapus atau tandai unsupported.

---

# 35. Hard No-Go Rules

Codex dilarang:

1. Mengubah TIRTA menjadi flood simulation.
2. Memasang SWMM hanya agar terlihat lebih canggih.
3. Menggunakan AI untuk memilih plan.
4. Membuat hidden score.
5. Menebak C dari subtype tanpa provenance.
6. Menebak infiltration dari vegetation name.
7. Menyebut non-runoff sebagai infiltration.
8. Menghitung peak discharge dari rainfall depth saja.
9. Double-count porous surface.
10. Menganggap image recognition sebagai ground truth.
11. Menganggap sumur resapan feasible tanpa site evidence yang dibutuhkan.
12. Menganggap literature performance sebagai site measurement.
13. Mengklaim causal success dari satu field observation.
14. Mengubah Golden/original project secara langsung.
15. Menghapus pre-existing user work.
16. Mengubah core visual language tanpa kebutuhan.
17. Melakukan unrelated refactor.
18. Menambahkan dependency besar tanpa justification.

---

# 36. Execution Strategy

Perombakan dilakukan bertahap.

## Phase 0 — Reconnaissance

Sebelum write:

- inspect git status;
- identify current authoritative working repo;
- identify protected Golden copies;
- inspect architecture;
- locate domain/calculation modules;
- locate storage/migration;
- locate tests;
- locate export/import;
- capture current live/local screenshots;
- capture existing baseline fixtures;
- run complete baseline test/build.

Output:

**repo map + current-state audit + exact ExecPlan**

No product modification yet.

---

## Phase 1 — Evidence Foundation

Create:

- Evidence Registry;
- Claim Registry;
- evidence validation;
- reference UI primitives;
- provenance types.

No behaviour changes yet.

---

## Phase 2 — Domain Schema & Migration

Add:

- provenance;
- new surface metadata;
- rainfall duration;
- connection model;
- feasibility state;
- schema migration.

Lock baseline parity.

---

## Phase 3 — Surface & Rainfall UX

Implement scientific metadata using progressive disclosure.

Do not redesign core screen.

---

## Phase 4 — Connectivity

Implement source → destination relationships.

Add tests.

---

## Phase 5 — Feasibility Engine

Implement rules for four intervention families.

Rules must stay separate from rendering layer.

Every rule must reference claim/evidence IDs.

---

## Phase 6 — Alternative Engine Integration

Integrate feasibility before enumeration.

Preserve deterministic Pareto behaviour.

Re-run conservation suite.

---

## Phase 7 — Evidence UX

Expose rationale, evidence, provenance, unknowns, and limitations.

---

## Phase 8 — Field Evaluation

Implement post-plan observation workflow.

Keep observations separate from predictive core.

---

## Phase 9 — Export / Import / Migration

Update backups and report.

Test backwards compatibility.

---

## Phase 10 — Full Verification

Run:

- unit tests;
- domain tests;
- migration tests;
- integration tests;
- build/typecheck;
- full browser flow;
- visual QA;
- responsive QA;
- console check;
- scientific claim audit;
- diff review.

Only after fresh evidence may implementation be called complete.

---

# 37. Completion Definition

Perombakan dinyatakan selesai hanya jika:

- ≥20 peer-reviewed journals are in the core evidence registry;
- Indonesia-specific evidence is represented;
- SNI source is handled separately and accurately;
- every scientific decision rule is traceable;
- all five surfaces retain compatibility;
- UNKNOWN is preserved;
- baseline conservation passes;
- no unsupported L/s/peak-flow claim remains;
- existing porous vs proposed porous are distinguishable;
- all four interventions have feasibility rules;
- infeasible/incomplete candidates cannot silently become recommendations;
- Pareto remains deterministic;
- no hidden ranking exists;
- migration passes;
- export includes assumptions/evidence;
- field evaluation works without claiming causal proof;
- baseline/golden tests pass;
- build passes;
- browser QA passes;
- current protected originals remain untouched.

---

# 38. Required Artifacts Before Implementation Is Considered Done

Codex must leave behind repository documentation equivalent to:

1. **Scientific Revision PRD**
2. **Evidence Matrix**
3. **Claim Registry**
4. **Domain Design**
5. **Migration Plan**
6. **Validation/Test Plan**
7. **ExecPlan**
8. **Change Log**
9. **Verification Report**

Exact filenames and locations should follow the existing repository structure after reconnaissance.

Do not create duplicate documentation systems if equivalent project conventions already exist.

---

# 39. Guiding Principle

Whenever TIRTA has to choose between:

**appearing more intelligent**

and

**being scientifically honest**

choose scientific honesty.

Whenever required information is unavailable:

**show what is unknown, why it matters, and what would be needed to resolve it.**

That behaviour is a feature, not a failure.