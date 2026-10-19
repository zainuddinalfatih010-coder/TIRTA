import { decisionPackage, alternativeAdvantages, comparisonExplanation, dominanceExplanation, interventionAdvice, interventionReferences, componentReference, componentResearch, planComposition, saveDeclaredVariant } from "../domain/decisionSupport";
import { assessPackage, packageRecommendations, parcelPackageTemplates, type PackageTemplate } from "../domain/packageRecommendations";
import { type Alternative, type Plan } from "../domain/planningEngine";
import { projectV2Schema, type ProjectV2 } from "../domain/projectV2";
import { alternativeSearch, fmt } from "./productionBridge";
import "./decision-support.css";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { ContextDialog } from "./ContextDialog";
import { InterventionIllustration } from "./Visuals";

export function ContextualAdvice({ project, scenario, onZone, onTry }: { project: ProjectV2; scenario: string; onZone: (id: string) => void; onTry: (family: keyof typeof interventionReferences, zoneId: string) => void }) {
  const advice = interventionAdvice(project, scenario);
  return <details className="source-note decision-support" data-testid="contextual-advice">
    <summary>Saran intervensi per zona</summary>
    <p>{advice.message}</p>
    {advice.items.map(item => <div className="advice-zone" key={item.zoneId}>
      <button className="text-button" onClick={() => onZone(item.zoneId)}>{item.zoneName}</button>
      <span>{fmt(item.runoff)} m³ · {fmt(item.share * 100)}% limpasan awal</span>
      <p>{item.condition}</p>
      {item.blocked.length > 0 && <p>{item.blocked.join(" ")}</p>}
      <div className="advice-actions">{item.choices.map(family => <button className="text-button" key={family} onClick={() => onTry(family, item.zoneId)}>Coba {family === "storage" ? "Tangki" : family === "infiltration" ? "Resapan" : family === "rain-garden" ? "Rain garden" : "Permukaan berpori"}<span className="sr-only"> untuk {item.zoneName}</span></button>)}</div>
    </div>)}
    <p className="quiet">Saran memakai kontribusi limpasan awal dan jenis permukaan yang Anda konfirmasi. Isi biaya, kapasitas, dan kondisi lokasi berdasarkan data lapangan. Posisi pada sketsa tidak menunjukkan sambungan air.</p>
    <details><summary>Referensi saran</summary>{Object.values(interventionReferences).map(ref => <p key={ref.url}><a href={ref.url} target="_blank" rel="noreferrer">{ref.name}</a></p>)}</details>
  </details>;
}

export function SearchExplanation({ search, rainfall }: { search: ReturnType<typeof alternativeSearch>; rainfall: number | null }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const candidates = [
    ...search.excluded.map((item, index) => ({ id: `excluded-${index}`, plan: item.plan, category: 'Batas / syarat belum terpenuhi', reasons: [...new Set(item.reasons)] })),
    ...search.superseded.map((item, index) => ({ id: `superseded-${index}`, plan: item.candidate.plan, category: 'Tersisih oleh paket lain', reasons: [dominanceExplanation(item.candidate, item.by)] })),
  ];
  const filtered = candidates.filter(item => `${item.plan.name} ${planComposition(item.plan)} ${item.reasons.join(' ')}`.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID')));
  const active = filtered.find(item => item.id === selectedId) ?? filtered[0];
  return <details open className="source-note decision-support" data-testid="search-explanation">
    <summary>Mengapa {search.rejected + search.dominated} kombinasi tidak ditampilkan?</summary>
    <p>Pada {rainfall === null ? "hujan aktif" : `${fmt(rainfall)} mm`}: {search.rejected} melanggar batas / syarat, {search.dominated} tersisih oleh pilihan yang setara atau lebih baik di ketiga ukuran. Ini tidak berarti teknologi tersebut buruk di semua kondisi.</p>
    {candidates.length > 0 && <div className="search-exclusion-browser">
      <label>Cari paket atau alasan<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nama intervensi atau data yang kurang"/></label>
      <label>Paket tersisih<select aria-label="Paket tersisih" value={active?.id ?? ''} disabled={!filtered.length} onChange={e => setSelectedId(e.target.value)}>{filtered.map(item => <option key={item.id} value={item.id}>{item.plan.name} · {planComposition(item.plan)}</option>)}</select></label>
      <p className="quiet">{filtered.length} dari {candidates.length} paket · detail satu paket</p>
      {active ? <section className="search-exclusion-detail" aria-label="Alasan paket tersisih"><h3>{active.plan.name}</h3><p>{planComposition(active.plan)}</p><strong>{active.category}</strong><ul>{active.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></section> : <p>Tidak ada paket atau alasan yang cocok.</p>}
    </div>}
    {!candidates.length && search.issues.length > 0 && <ul className="search-input-issues">{[...new Set(search.issues)].map(issue => <li key={issue}>{issue}</li>)}</ul>}
    {!search.rejected && !search.dominated && !search.issues.length && <p>Semua kombinasi yang diperiksa ditampilkan.</p>}
  </details>;
}

export function AlternativeExplanation({ candidate, peers }: { candidate: Alternative; peers: Alternative[] }) {
  return <details className="source-note decision-support alternative-explanation"><summary>Kelebihan & konsekuensi</summary><ul>{alternativeAdvantages(candidate, peers).map(item => <li key={item}>{item}</li>)}</ul><p>Paket yang lebih hemat biaya dapat menyisakan lebih banyak limpasan. Perbandingan memakai hujan aktif.</p></details>;
}

export function RunoffRecommendation({ project, candidate, scenario }: { project: ProjectV2; candidate: Alternative; scenario: string }) {
  const b = candidate.balance;
  const assessment = assessPackage(project, candidate.plan, scenario);
  const rain = project.scenarios.find(s => s.id === scenario)?.name ?? "hujan aktif";
  return <div className="runoff-reason" data-testid="runoff-recommendation">
    <p><strong>Mengapa paket ini?</strong> Menangani {fmt(b.baseline - b.residual)} m³ ({fmt((b.baseline - b.residual) / b.baseline * 100)}%) air limpasan, dengan sisa paling kecil di antara paket yang memenuhi batas pada {rain}.</p>
    <p><strong>{assessment.status === "met" ? "Target tercapai pada model." : assessment.status === "not-met" ? "Target Anda belum tercapai." : "Target keberhasilan belum dapat dinilai."}</strong> Paling efektif di antara pilihan ini belum berarti cukup. {assessment.checks.length > 0 && `${assessment.checks.length} syarat penerapan masih perlu diperiksa.`}</p>
    <details className="source-note decision-support"><summary>Dasar & batas rekomendasi</summary>
      <p>Prioritasnya hanya sisa limpasan terkecil, menggunakan hasil sebelum pembulatan. Tidak ada skor gabungan atau bobot tersembunyi. Biaya Rp{fmt(b.cost)} dan lahan {fmt(b.area)} m² memenuhi batas yang Anda nyatakan; paket ini belum tentu paling murah atau paling hemat lahan.</p>
      <p>{assessment.status === "met" ? "Target pengguna juga terpenuhi pada hujan yang wajib diperiksa." : assessment.status === "not-met" ? "Efektivitas tertinggi ini masih belum memenuhi target pengguna pada semua hujan wajib." : "Pencapaian target belum dapat disimpulkan dari input yang tersedia."} Penandaan ini berlaku untuk hujan aktif. Hasil pada hujan lain dapat berbeda.</p>
      {!!assessment.checks.length && <><p>Syarat penerapan yang masih perlu diperiksa:</p><ul>{assessment.checks.map(check => <li key={check}>{check}</li>)}</ul></>}
      <p>Estimasi berdasarkan data dan asumsi Anda, bukan jaminan bebas genangan atau kelayakan konstruksi.</p>
    </details>
  </div>;
}

export function PlanningIntent({ project, onProject }: { project: ProjectV2; onProject: (project: ProjectV2) => void }) {
  const [metric, setMetric] = useState<"reduction-percent" | "residual-m3">(project.planningGoal.target?.metric ?? "reduction-percent");
  const [error, setError] = useState("");
  const [targetDraft, setTargetDraft] = useState(String(project.planningGoal.target?.value ?? ""));
  return <details className="source-note decision-support"><summary>Tujuan rencana & hujan yang wajib diperiksa</summary>
    <label>Tujuan Anda<textarea maxLength={2000} defaultValue={project.planningGoal.note} placeholder="Misalnya: mengurangi limpasan dengan biaya yang sanggup saya tanggung" onBlur={e => { if (e.target.value !== project.planningGoal.note) onProject(projectV2Schema.parse({ ...project, planningGoal: { ...project.planningGoal, note: e.target.value } })); }} /></label>
    <form data-testid="planning-target" onSubmit={e => {
      e.preventDefault(); const raw = String(new FormData(e.currentTarget).get("targetValue") ?? "").trim();
      const { target: previous, ...goal } = project.planningGoal;
      void previous;
      try {
        onProject(projectV2Schema.parse({ ...project, planningGoal: raw ? { ...goal, target: { metric, value: Number(raw), source: "Target pra-perencanaan yang ditetapkan pengguna" } } : goal })); setError("");
      } catch { setError("Isi target 0–100% atau sisa volume minimal 0 m³. Kosong berarti target belum ditentukan."); }
    }}><label>Ukuran keberhasilan pada model<select aria-label="Ukuran keberhasilan pada model" value={metric} onChange={e => { const next = e.target.value === "residual-m3" ? "residual-m3" : "reduction-percent"; setMetric(next); setTargetDraft(project.planningGoal.target?.metric === next ? String(project.planningGoal.target.value) : ""); setError("Satuan berubah. Isi target untuk satuan ini, lalu terapkan; target tersimpan belum berubah."); }}><option value="reduction-percent">Minimal pengurangan limpasan (%)</option><option value="residual-m3">Maksimal sisa limpasan (m³)</option></select></label><label>{metric === "reduction-percent" ? "Target pengurangan (%)" : "Batas sisa limpasan (m³)"}<input name="targetValue" type="number" min="0" max={metric === "reduction-percent" ? 100 : undefined} step="any" value={targetDraft} onChange={e => setTargetDraft(e.target.value)} placeholder="Belum ditentukan" /></label><small>Target Anda adalah asumsi tujuan, bukan sertifikasi bebas genangan. Tidak mengubah rumus atau memberi bobot pada pencarian.</small><button type="submit">Terapkan target rencana</button>{error && <p role="status">{error}</p>}</form>
    <p>Hujan aktif selalu diperiksa. Pilih hujan tambahan yang juga wajib memiliki data lengkap dan memenuhi batas. Tidak ada kapasitas yang disalin otomatis.</p>
    {project.scenarios.map(s => <label className="check-line" key={s.id}><input type="checkbox" checked={project.constraints.requiredScenarioIds.includes(s.id)} onChange={e => onProject(projectV2Schema.parse({ ...project, constraints: { ...project.constraints, requiredScenarioIds: e.target.checked ? [...project.constraints.requiredScenarioIds, s.id] : project.constraints.requiredScenarioIds.filter(id => id !== s.id) } }))} />{s.name}</label>)}
    <small>Tujuan tidak menjadi skor atau bobot tersembunyi. Penyaringan tetap berdasarkan sisa limpasan, biaya, dan lahan pada hujan aktif.</small>
  </details>;
}

export function DecisionConclusion({ project, plan, scenario, stale, peers, onNote, onCompare, onRefine }: { project: ProjectV2; plan: Plan; scenario: string; stale: boolean; peers: Alternative[]; onNote: (note: string) => void; onCompare?: () => void; onRefine?: () => void }) {
  const report = decisionPackage(project, plan, scenario);
  if (!report.ok) return <section className="decision-support"><h3>Kesimpulan belum tersedia</h3><ul>{report.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><ReplacementAdvice project={project} plan={plan} scenario={scenario} peers={peers} onCompare={onCompare} onRefine={onRefine} /><p>Periksa data dan batas rencana untuk hujan ini.</p></section>;
  return <section className="decision-support decision-conclusion" aria-labelledby="decision-conclusion-title">
    <h3 id="decision-conclusion-title">Kesimpulan rencana Anda</h3>
    {stale && <p role="status">Data berubah setelah rencana dipilih. Hasil berikut memakai data terbaru untuk paket lama. Tinjau dan pilih kembali sebelum mengunduh ringkasan.</p>}
    <p>{report.summary}</p>
    <PackageOutcome project={project} plan={plan} scenario={scenario} />
    <ReplacementAdvice project={project} plan={plan} scenario={scenario} peers={peers} onCompare={onCompare} onRefine={onRefine} />
    <p><strong>Status:</strong> {report.provisional ? "hasil masih memuat asumsi atau data demo, perlu verifikasi." : "memenuhi data dan batas yang dinyatakan; kelayakan lapangan tetap perlu diperiksa."}</p>
    {project.planningGoal.note && <p><strong>Tujuan Anda:</strong> {project.planningGoal.note}</p>}
    <ul>{report.tradeoffs.map(item => <li key={item}>{item}</li>)}</ul>
    <p>{report.robustness}</p>
    <details className="source-note"><summary>Mengapa memilih ini dibanding pilihan lain?</summary><p>Perbandingan biaya, lahan, dan sisa limpasan pada hujan aktif.</p>{report.scenarioResults.find(s => s.id === scenario)?.outcome.ok && peers.filter(p => p.plan.id !== plan.id).map(other => {
      const active = report.scenarioResults.find(s => s.id === scenario)!.outcome;
      return active.ok ? <p key={other.plan.id}>{comparisonExplanation({ plan, balance: active.value }, other)}</p> : null;
    })}{peers.filter(p => p.plan.id !== plan.id).length === 0 && <p>Tidak ada alternatif lain yang tersedia pada pencarian aktif. Tambahkan varian yang datanya diketahui untuk perbandingan.</p>}</details>
    <details className="source-note"><summary>Hasil & kendala pada setiap hujan</summary><ul>{report.scenarioResults.map(s => <li key={s.id}><strong>{s.name}{s.rain === null ? "" : ` · ${fmt(s.rain)} mm`}:</strong> {s.outcome.ok ? `${fmt(s.outcome.value.residual)} m³ sisa; memenuhi batas.` : s.outcome.issues.map(i => i.message).join(" ")}</li>)}</ul></details>
    <details className="source-note"><summary>Penggunaan air, jenis intervensi & langkah lapangan</summary><ul>{report.checks.map(item => <li key={item}>{item}</li>)}</ul><p>Catatan belum membuktikan kelayakan teknik. Verifikasi sambungan, tanah, kebutuhan air, biaya, dan pemeliharaan bersama pihak yang kompeten.</p>{plan.components.filter(c => c.enabled).map(c => <p key={c.id}><a href={componentReference(c).url} target="_blank" rel="noreferrer">{componentReference(c).name}</a> · rujukan praktik, bukan parameter lokasi otomatis.</p>)}</details>
    <details className="source-note"><summary>Catat alasan Anda memilih rencana ini</summary><label>Alasan pilihan<textarea maxLength={2000} defaultValue={project.selectedPlan?.decisionNote ?? ""} onBlur={e => onNote(e.target.value)} placeholder="Apa yang paling sesuai kebutuhan Anda?" /></label></details>
    <details className="source-note"><summary>Penelitian pendukung & kecocokan studi kasus</summary>{plan.components.filter(c => c.enabled).map(c => { const ref = componentResearch(c); return <div key={c.id}><p><strong>{c.name}</strong>: <a href={ref.url} target="_blank" rel="noreferrer">{ref.name}</a></p><small>{ref.relevance}</small></div>; })}<p>Untuk kasus genangan gedung MA Permata, lengkapi hasil ukur hujan, luas, penyaluran, kondisi tanah dan kapasitas setempat. Penurunan volume limpasan dalam TIRTA belum membuktikan genangan hilang; tidak ada simulasi drainase atau kedalaman.</p></details>
    <details className="source-note"><summary>Batas pembuktian aplikasi</summary><p>Ini alat keputusan pra-perencanaan. Tidak memprediksi genangan atau memberikan sertifikasi konstruksi. Analisis foto lokal saat ini memakai heuristik, bukan model terlatih tervalidasi. Data demo bukan hasil ukur MA Permata; validasi studi kasus dan uji lapangan perlu bukti tersendiri.</p></details>
  </section>;
}

export function VariantLibrary({ project, scenario, onProject }: { project: ProjectV2; scenario: string; onProject: (project: ProjectV2) => void }) {
  const [error, setError] = useState("");
  return <details className="source-note decision-support" data-testid="variant-library"><summary>Bandingkan ukuran / komposisi lain · {project.manualPlans.length} varian tersimpan</summary>
    <p>Simpan paket saat ini sebagai varian, lalu ubah kapasitas, biaya, atau intervensinya untuk membandingkan paket lain.</p>
    <form onSubmit={e => { e.preventDefault(); try { const name = String(new FormData(e.currentTarget).get("variantName") ?? ""); onProject(saveDeclaredVariant(project, scenario, name, `variant-${crypto.randomUUID()}`)); setError(""); e.currentTarget.reset(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Varian belum dapat disimpan."); } }}>
      <label>Nama varian<input name="variantName" required maxLength={120} placeholder="Misalnya: Tangki kecil + resapan" /></label>
      <button type="submit">Simpan konfigurasi sebagai varian</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {project.manualPlans.map(plan => <div className="advice-zone" key={plan.id}><strong>{plan.name}</strong><p>{planComposition(plan)}</p><button className="text-button" onClick={() => { if (window.confirm(`Hapus varian “${plan.name}”? Rencana yang sudah dipilih tetap tersimpan.`)) onProject(projectV2Schema.parse({ ...project, manualPlans: project.manualPlans.filter(p => p.id !== plan.id) })); }}>Hapus varian {plan.name}</button></div>)}
  </details>;
}

const packageStatus = {
  met: "Target tercapai pada model",
  "not-met": "Target belum tercapai",
  unknown: "Target belum dapat dinilai",
  blocked: "Paket tidak dapat digunakan dengan data / batas ini",
};

export function PackageOutcome({ project, plan, scenario, compact = false }: { project: ProjectV2; plan: Plan; scenario: string; compact?: boolean }) {
  const assessment = assessPackage(project, plan, scenario);
  const body = <>
    {assessment.target ? <div className="target-reference"><span>Target Anda</span><strong>{assessment.target.metric === "reduction-percent" ? `≥ ${fmt(assessment.target.value)}% pengurangan` : `≤ ${fmt(assessment.target.value)} m³ sisa`}</strong></div> : <p>Tetapkan target di Tujuan rencana. Batas anggaran berbeda dengan target penanganan air.</p>}
    <ul className="scenario-outcomes" aria-label="Hasil target pada hujan yang diperiksa">{assessment.scenarios.map(s => <li key={s.id}><strong>{s.name}</strong><span>{!s.outcome.ok ? s.outcome.issues.map(i => i.message).join(" ") : s.targetMet === false ? <>Perlu tambahan <strong>{fmt(s.extraVolume!)} m³</strong></> : s.targetMet === true ? "Target terpenuhi · dalam batas" : assessment.target ? "Belum dinilai · limpasan awal nol" : "Target belum ditentukan"}</span></li>)}</ul>
    {!!assessment.checks.length && <details className="source-note"><summary>Masih {assessment.checks.length} pemeriksaan sebelum penerapan</summary><ul>{assessment.checks.map(check => <li key={check}>{check}</li>)}</ul></details>}
    <small>{assessment.status === "met" ? "Dapat dibawa sebagai paket pra-perencanaan" : "Hasil uji pra-perencanaan"}{assessment.checks.length ? "; penerapan masih bersyarat pada pemeriksaan di atas" : "; hasil tetap perlu verifikasi teknis"}. Bukan jaminan bebas genangan atau desain konstruksi.</small>
  </>;
  return compact ? <details className="source-note package-outcome" data-testid="package-outcome"><summary>{packageStatus[assessment.status]}</summary>{body}</details> : <div className="package-outcome" data-testid="package-outcome"><strong>{packageStatus[assessment.status]}</strong>{body}</div>;
}

export function ReplacementAdvice({ project, plan, scenario, peers, onCompare, onRefine }: { project: ProjectV2; plan: Plan; scenario: string; peers: Alternative[]; onCompare?: () => void; onRefine?: () => void }) {
  const current = assessPackage(project, plan, scenario);
  const candidates = packageRecommendations(project, peers.filter(p => p.plan.id !== plan.id), scenario);
  const matches = candidates.filter(c => c.assessment.status === "met");
  if (current.status === "met") return <p>Target tercapai pada skenario yang diperiksa. Sebelum memilih, tinjau biaya, lahan, penggunaan air, dan syarat lapangannya.</p>;
  return <div className="replacement-advice" data-testid="replacement-advice"><h4>Jika paket ini belum cukup, apa pilihan berikutnya?</h4>
    {matches.length ? <><p>{matches.length} paket lain memenuhi target dan batas rencana. Bandingkan biaya, lahan, dan syarat penerapannya.</p><ul>{matches.map(c => <li key={c.plan.id}><strong>{planComposition(c.plan)}</strong> · {fmt(c.balance.residual)} m³ sisa · Rp{fmt(c.balance.cost)} · {fmt(c.balance.area)} m²{c.assessment.checks.length ? " · kondisi lapangan belum lengkap" : " · perlu verifikasi teknis"}</li>)}</ul></> : <p>{current.target ? "Belum ada paket lain yang memenuhi target pada semua hujan wajib. " : "Tetapkan target dahulu agar TIRTA dapat menjelaskan paket pengganti yang cukup. "}Coba varian kapasitas / komposisi dengan dasar angka yang Anda ketahui, lalu cari paket kembali. Aplikasi tidak menaikkan kapasitas, biaya, atau batas secara otomatis.</p>}
    {!!current.unhandledZones.length && <p>Sisa terbesar: {current.unhandledZones.slice(0, 3).map(z => `${z.name} ${fmt(z.volume)} m³`).join("; ")}. Periksa apakah sumber air ini sudah tertangani; menambah kapasitas pada target lain belum tentu membantu.</p>}
    <div className="advice-actions">{matches.length > 0 && onCompare && <button className="text-button" onClick={onCompare}>Bandingkan paket pengganti</button>}{onRefine && <button className="text-button" onClick={onRefine}>Perbaiki opsi / target rencana</button>}</div>
  </div>;
}

export function PackageAdvisor({ project, scenario, search, onCompare, onPrepare }: { project: ProjectV2; scenario: string; search: ReturnType<typeof alternativeSearch>; onCompare: () => void; onPrepare: (template: PackageTemplate) => void }) {
  const packages = packageRecommendations(project, search.rows.map(row => ({ plan: row.plan, balance: row.balance })), scenario);
  const templates = parcelPackageTemplates(project, scenario);
  const [inspected, setInspected] = useState<PackageTemplate | null>(null);
  const familyName = (option: PackageTemplate["options"][number]) => option.biopori ? "Biopori" : option.family === "storage" ? "Tangki" : option.family === "infiltration" ? "Sumur / area resapan" : option.family === "rain-garden" ? "Taman hujan" : "Permukaan berpori";
  const kind = (option: PackageTemplate["options"][number]) => option.biopori ? "biopori" as const : option.family === "storage" ? "tank" as const : option.family === "infiltration" ? "soak" as const : option.family === "rain-garden" ? "garden" as const : "porous" as const;
  return <section className="decision-support package-advisor" data-testid="package-advisor" aria-labelledby="package-advisor-title">
    <h3 id="package-advisor-title">Paket untuk seluruh persil</h3>
    <p className="quiet package-caption">Rancangan awal · angka dan lokasi perlu diperiksa. Nomor mengikuti zona persil.</p>
    <div data-testid="parcel-package-templates" className="package-template-list">
      {templates.map(t => <div className="package-template" key={t.id}>
        <div className="package-template-content"><strong>{t.name}</strong><div className="package-source-map" aria-label={`Sumber air untuk ${t.name}`}>{t.options.map((o, i) => <div className="package-source-group" key={i}><span className="package-zone-group">{o.targets.map(id => { const index = project.zones.findIndex(z => z.id === id); return <span key={id} title={project.zones[index]?.name ?? id} className="package-zone-reference"><span aria-hidden="true">{index < 0 ? "?" : index + 1}</span><span className="sr-only">{project.zones[index]?.name ?? id}</span></span>; })}</span><ArrowRight size={14} aria-hidden="true" /><span className="package-family-symbol" title={familyName(o)}><InterventionIllustration kind={kind(o)} /><span className="sr-only">{familyName(o)}</span></span></div>)}</div></div>
        <div className="package-template-actions"><button type="button" className="text-button" aria-label={`Alasan paket ${t.name}`} onClick={() => setInspected(t)}>Alasan</button><button type="button" className="text-button" aria-label={`Siapkan paket ${t.name}`} onClick={() => onPrepare(t)}>Siapkan <ArrowRight size={16} aria-hidden="true" /></button></div>
      </div>)}
      {!templates.length && <p>Lengkapi data persil dan hujan untuk melihat rancangan paket. Jika limpasan nol, kebutuhan intervensi belum dapat ditentukan.</p>}
    </div>
    <div className="package-search-status">
      <span>{packages.length ? <><strong>{packages.length}</strong> paket dalam batas{project.planningGoal.target && <> · <strong>{packages.filter(p => p.assessment.status === "met").length}</strong> memenuhi target Anda</>}</> : "Lengkapi opsi, lalu periksa paket dalam batas Anda."}</span>
      <button type="button" className="text-button" onClick={onCompare}>Bandingkan paket <ArrowRight size={16} aria-hidden="true" /></button>
    </div>
    {inspected && <ContextDialog title={inspected.name} onClose={() => setInspected(null)} footer={<button type="button" onClick={() => { onPrepare(inspected); setInspected(null); }}>Siapkan paket {inspected.name}</button>}>
      <p>{inspected.reason}</p><ul>{inspected.options.map((o, i) => <li key={i}><strong>{familyName(o)}</strong> ← {o.targets.map(id => project.zones.find(z => z.id === id)?.name ?? id).join(", ")}</li>)}</ul>
      <p className="quiet">Rancangan untuk diuji, bukan siap bangun. Konfirmasi sumber air dan penyaluran; biaya, kapasitas dan kondisi lokasi tetap dari data Anda.</p>
    </ContextDialog>}
  </section>;
}
