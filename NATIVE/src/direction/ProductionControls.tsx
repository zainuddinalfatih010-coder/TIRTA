import { evidenceLabel } from "./decisionFeedback";
import { InterventionArt } from "./InterventionWorkspace";
import { InterventionScience } from './InterventionScience';
import { ContextDialog } from "./ContextDialog";
import { CalculationSource } from "./CalculationSource";
import { useState } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import { emptyInput, readInput, saveComponent, type SourcedInput } from "../domain/planningAuthoring";
import { savePlanningLimits, sharedPlanningSpace, planningSpaceId } from "../domain/planningWorkspace";
import { componentEditorValues, fmt, money, setActiveComponents, type OptionId } from "./productionBridge";
import { evidenceSchema } from "../domain/model";
import { SourceChoice, sourceChoices } from "./SourceChoice";
import { PlanningNumberForm, NumberChangeSummary, usePlanningNumbers } from "./PlanningNumberForm";
import { RupiahInput } from "./RupiahInput";
import { rupiahCanonical } from "./planningNumbers";
import { numericInput } from "../domain/validation";
import { planningError } from "./planningError";
import { InterventionTarget } from "./InterventionTarget";
import { interventionReferences, operationalGuidance } from "../domain/decisionSupport";
import { componentReference, componentResearch } from "../domain/decisionSupport";
import { waterUses } from "../domain/packageRecommendations";
import { siteAssessmentSchema } from "../domain/intervention-contract";
import { z } from "zod";
import { interventionReview } from "../domain/interventionReview";
import { HelpButton } from "./TirtaHelp";
export function SourceField({ label, unit, initial, name, missing = false, limit, help }: { label: string; unit: string; initial: SourcedInput; name: string; missing?: boolean; limit?: number | null; help?: string }) {
  const { values, setValue } = usePlanningNumbers();
  const text = values[name] ?? "";
  const invalid = !numericInput(unit === "Rp" ? rupiahCanonical(text) : text).ok || (missing && !text.trim());
  return <div className="sourced-control">
    <label>{label} ({unit}){unit === "Rp" ? <RupiahInput name={name} aria-label={`${label} (${unit})`} placeholder="Belum diketahui" value={text} onChange={value => setValue(name, value)} aria-invalid={invalid || undefined} aria-describedby={`${name}-help`} /> : <input name={name} aria-label={`${label} (${unit})`} type="number" min="0" step="any" placeholder="Belum diketahui" value={text} onChange={e => setValue(name, e.target.value)} aria-invalid={invalid || undefined} aria-describedby={`${name}-help`} />}</label>
    <details className="number-source"><summary>{initial.source && initial.source !== "Asumsi pribadi" ? "Lihat / ubah sumber" : "Perkiraan Anda · ubah sumber"}</summary><SourceChoice name={name} label={`Sumber / alasan ${label.toLowerCase()}`} initial={initial.source ? initial : { ...initial, source: "Asumsi pribadi", evidence: "ASSUMPTION" }} choices={name === "budget" ? sourceChoices.budget : unit === "Rp" ? sourceChoices.cost : unitChoices(unit)} /></details>
    <small id={`${name}-help`}>{invalid ? <span className="field-error">{text ? "Periksa angka yang dimasukkan." : "Belum diketahui; boleh disimpan untuk nanti."}{unit === "Rp" && " Contoh: 1.200.000 atau 1.200.000,50."}</span> : null}{help && <span className="field-explanation">{help}</span>}</small>
    {limit != null && text && Number(text) > limit && <small className="field-warning" role="status">{text} m² melebihi sisa lahan yang dinyatakan ({fmt(limit)} m²). Pilihan yang melampaui batas akan ditolak; angka tidak diubah otomatis.</small>}
  </div>;
}
function ResapanType({ initial, onChanged }: { initial: "well" | "biopori"; onChanged: () => void }) {
  const { setValue } = usePlanningNumbers();
  return <label>Jenis resapan<select aria-label="Jenis resapan" name="infiltrationType" defaultValue={initial} onChange={() => { setValue("capacity", ""); setValue("cost", ""); setValue("area", ""); onChanged(); }}><option value="well">Sumur / area resapan</option><option value="biopori">Lubang resapan biopori</option></select><small>Mengganti jenis mengosongkan angka dan dasar kapasitas lama.</small></label>;
}
const unitChoices = (unit: string) => unit === "m²" ? sourceChoices.area : sourceChoices.capacity;
const fromForm = (f: FormData, name: string, currency = false): SourcedInput => ({ text: currency ? rupiahCanonical(String(f.get(name) ?? "")) : String(f.get(name) ?? ""), source: String(f.get(`${name}Source`) ?? ""), evidence: evidenceSchema.parse(f.get(`${name}Evidence`) ?? "USER_INPUT") });
export function ComponentConfiguration({ project, id, scenario, onProject, missing = false, initiallyOpen = false, embedded = false }: { embedded?: boolean; initiallyOpen?: boolean; missing?: boolean; project: ProjectV2; id: OptionId; scenario: string; onProject: (p: ProjectV2) => void }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(initiallyOpen);
  const [engineeringReset, setEngineeringReset] = useState(0);
  const values = componentEditorValues(project, id, scenario);
  if (!values) return <p className="quiet option-configuration">Tambahkan untuk menentukan target dan kapasitas.</p>;
  const { component: c, capacity, cost, area } = values;
  const perf = c.performanceByScenario[scenario];
  const land = project.parameters.find(p => p.id === project.constraints.usableArea.id)?.value;
  const otherAreas = project.components.filter(c => c.enabled && c.id !== id).map(c => project.parameters.find(p => p.id === c.occupiedArea.id)?.value);
  const incompleteAreas = otherAreas.some(a => a == null);
  const available = land == null ? null : incompleteAreas ? land : Math.max(0, land - otherAreas.reduce<number>((n, a) => n + a!, 0));
  const reuse = perf && "reuse" in perf && perf.reuse.mode === "capture-then-reuse" ? readInput(project, perf.reuse.demand, scenario) : null;
  const capacityLabel = c.family === "storage" ? "Tampungan tersedia per kejadian" : "Air yang dapat diresapkan";
  const formId = `component-configuration-${id}`;
  const incomplete = !capacity.text || !cost.text || !area.text || !c.targets.length || !c.installationSiteId || !perf?.applicability;
  return <>
    {!embedded && <><dl className="option-facts">
      <div><dt>{c.family === "storage" ? "Tampungan tersedia" : "Infiltrasi"}</dt><dd><button className="fact-edit" onClick={() => setOpen(true)}>{capacity.text || "?"} <small>m³/event</small></button></dd></div>
      <div><dt>Biaya</dt><dd><button className="fact-edit" onClick={() => setOpen(true)}>{cost.text ? money(Number(cost.text)) : "?"}</button></dd></div>
      <div><dt>Ruang</dt><dd><button className="fact-edit" onClick={() => setOpen(true)}>{area.text || "?"} <small>m²</small></button></dd></div>
    </dl>
    <InterventionScience project={project} id={id} scenarioId={scenario} onProject={onProject} />
    <button className="option-config-trigger text-button" onClick={() => setOpen(true)}>Atur intervensi</button>
    {incomplete && <small className="option-draft-note">Isian belum lengkap. Lengkapi atau simpan untuk nanti agar opsi lain bisa dibandingkan.</small>}
    {interventionReview(project, [c], scenario).map(note => <small key={note.kind} className="option-draft-note" role="status">{note.message} <button className="text-button" onClick={() => setOpen(true)}>Tinjau angka</button></small>)}
    </>}
    {(open || embedded) && <ContextDialog title={embedded && !open ? c.name : `Atur ${c.name}`} inline={embedded && !open} leading={embedded ? <InterventionArt kind={c.family === "storage" ? "tank" : c.family === "infiltration" ? "soak" : c.family === "rain-garden" ? "garden" : "porous"}/> : undefined} footer={<><div className="intervention-save-actions"><button form={formId} className="primary" type="submit" value="apply">Terapkan intervensi</button><button form={formId} type="submit" value="defer">Simpan untuk nanti</button></div>{embedded && <InterventionScience project={project} id={id} scenarioId={scenario} onProject={onProject}/>}</>} className={embedded ? "intervention-inspector" : ""} onClose={() => { setOpen(false); setEngineeringReset(0); }}>
      <PlanningNumberForm id={formId} key={`${id}:${scenario}:${c.revision}`} fields={[
        { name: "cost", label: "Biaya", unit: "Rp", initial: cost.text },
        { name: "area", label: "Ruang terpakai", unit: "m²", initial: area.text },
        { name: "capacity", label: "Kapasitas", unit: "m³/event", initial: capacity.text },
        { name: "reuse", label: "Kebutuhan penggunaan air", unit: "m³/event", initial: reuse?.text ?? "" },
      ]} onChange={() => setError("")} onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        const defer = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "defer";
        if (!defer) {
          const missingField = ["cost", "capacity", "area"].find(name => !String(f.get(name) ?? "").trim());
          if (missingField || !f.getAll("target").length) {
            setError("Intervensi belum siap: lengkapi biaya, kapasitas, ruang terpakai, dan zona sumber. Jika datanya belum diketahui, pilih Simpan untuk nanti.");
            const field = e.currentTarget.querySelector<HTMLInputElement>(missingField ? `input[name="${missingField}"]` : 'select[aria-label="Sumber air"],select[aria-label="Zona yang diganti"],input[name="target"]');
            let parent = field?.parentElement;
            while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
            field?.focus();
            return;
          }
        }
        try {
          const assessment = siteAssessmentSchema.safeParse(Object.fromEntries(["connection", "infiltration", "plantingSpace", "surfaceChange"].map(key => [key, String(f.get(`site-${key}`) ?? "unknown")]).concat([["source", String(f.get("site-source") ?? "")]])));
          if (!assessment.success) throw new Error("Tuliskan Dasar kondisi lokasi untuk jawaban Ya / Tidak yang Anda pilih. Belum diperiksa boleh dibiarkan tanpa sumber.");
          const next = saveComponent(sharedPlanningSpace(project), {
            id, name: c.family === "infiltration" ? (f.get("infiltrationType") === "biopori" ? "Biopori" : "Sumur / area resapan") : c.name, family: c.family, targets: f.getAll("target").map(String), siteId: c.installationSiteId && project.installationSites.some(s => s.id === c.installationSiteId) ? c.installationSiteId : planningSpaceId(project),
            connection: String(f.get("connection") ?? ""), applicability: (!engineeringReset && perf?.applicability) || "Kapasitas dinyatakan pengguna untuk jenis intervensi ini pada hujan yang dipilih; perkiraan pra-perencanaan, perlu verifikasi teknis.",
            cost: fromForm(f, "cost", true), area: fromForm(f, "area"), scenarioId: scenario, capacity: fromForm(f, "capacity"),
            reuse: f.get("reuseOn") ? fromForm(f, "reuse") : null,
            planningNotes: String(f.get("planningNotes") ?? ""),
            infiltrationType: c.family === "infiltration" ? z.enum(["well", "biopori"]).parse(f.get("infiltrationType")) : undefined,
            waterUse: c.family === "storage" ? z.enum(["unknown", "irrigation", "cleaning", "toilet", "temporary"]).parse(f.get("waterUse")) : undefined,
            drawdown: c.family === "storage" ? z.enum(["unknown", "planned", "unavailable"]).parse(f.get("drawdown")) : undefined,
            plantingPlan: c.family === "rain-garden" ? z.enum(["unknown", "adapted", "existing"]).parse(f.get("plantingPlan")) : undefined,
            siteAssessment: assessment.data,
          });
          onProject(defer ? setActiveComponents(next, next.components.filter(component => component.enabled && component.id !== id).map(component => component.id as OptionId)) : next); setError(""); setOpen(false); setEngineeringReset(0);
          if (defer) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.intervention-palette button[data-option="${id}"]`)?.focus());
        } catch (cause) { setError(planningError(cause)); }
      }}>
        <InterventionTarget project={project} targets={c.targets} porous={c.family === "permeable"} missing={missing} compact={embedded && !open} />
        {c.family === "infiltration" && <ResapanType initial={c.infiltrationType ?? "well"} onChanged={() => setEngineeringReset(n => n + 1)} />}
        {c.family === "infiltration" && <HelpButton topic="methods" method="biopori" label="Sumur atau biopori?"/>}
        <div className="intervention-primary-fields"><SourceField key={`capacity-${engineeringReset}`} missing={missing || !!error} label={embedded && !open ? "Kapasitas tersedia" : capacityLabel} name="capacity" unit="m³/event" initial={engineeringReset ? emptyInput() : capacity} help={c.family === "storage" ? "Ruang kosong saat hujan mulai. 1 m³ = 1.000 liter." : "Volume yang bisa meresap selama hujan ini; bukan otomatis dari luas. 1 m³ = 1.000 liter."} />
        <SourceField key={`cost-${engineeringReset}`} missing={missing || !!error} label="Biaya" name="cost" unit="Rp" initial={engineeringReset ? emptyInput() : cost} /></div>
        {c.family === "storage" && <details className="operation-choices"><summary>Bagaimana air digunakan?</summary><label>Air tampungan setelah hujan<select aria-label="Air tampungan setelah hujan" name="waterUse" defaultValue={c.waterUse ?? "unknown"}>{Object.entries(waterUses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Ruang untuk hujan berikutnya<select aria-label="Ruang untuk hujan berikutnya" name="drawdown" defaultValue={c.drawdown ?? "unknown"}><option value="unknown">Belum direncanakan</option><option value="planned">Akan digunakan / dikosongkan sebelum hujan berikutnya</option><option value="unavailable">Belum ada cara penggunaan / pengosongan</option></select></label><small>Penggunaan setelah hujan tidak dihitung dua kali. Air ini bukan otomatis layak diminum; sanitasi juga memerlukan pengolahan dan sambungan terpisah.</small></details>}
        {c.family === "rain-garden" && <label>Rencana vegetasi<select aria-label="Rencana vegetasi" name="plantingPlan" defaultValue={c.plantingPlan ?? "unknown"}><option value="unknown">Tanaman dan media belum ditentukan</option><option value="adapted">Tanaman sesuai kondisi basah–kering dan media lokasi</option><option value="existing">Adaptasi vegetasi yang sudah ada</option></select><small>Vegetasi yang ada sudah dihitung pada limpasan awal. Penanaman biasa bukan kapasitas infiltrasi baru; rain garden memerlukan media dan penyaluran air. Jenis tanaman lokal dipilih setelah kondisi lokasi diperiksa.</small></label>}
        <input type="hidden" name="connection" value={c.connectionNote || (c.family === "permeable" ? "Perlakuan langsung pada zona yang dipilih pengguna." : "Pengguna merencanakan penyaluran air dari zona yang dipilih ke intervensi ini; sambungan perlu dirancang dan diverifikasi.")} />
        <p className="direct-treatment">{c.family === "permeable" ? "Perlakuan langsung pada zona terpilih." : "Dengan menerapkan, Anda merencanakan air dari zona terpilih disalurkan ke intervensi ini. Letak simbol tidak menentukan sambungan."}</p>
        <details className="space-details" open={missing && !area.text}><summary>Ruang yang dipakai{area.text ? ` · ${area.text} m²` : " · belum diketahui"}</summary>
        <SourceField key={`area-${engineeringReset}`} missing={missing || !!error} limit={available} label={c.family === "permeable" ? "Luas yang diganti" : "Ruang terpakai"} name="area" unit="m²" initial={engineeringReset ? emptyInput() : area} help={c.family === "permeable" ? "Bagian zona yang akan diganti menjadi permukaan berpori. Ini juga dihitung sebagai lahan intervensi." : "Luas tempat pemasangan, bukan luas seluruh zona sumber air. Dipakai untuk mengecek batas lahan Anda."} />
        {incompleteAreas && <small>Total kebutuhan ruang belum diketahui karena opsi lain belum lengkap. Peringatan memakai batas lahan total Anda.</small>}
        </details>
        {c.family === "storage" && <details><summary>Pemakaian kembali selama kejadian</summary><label className="check-line"><input type="checkbox" name="reuseOn" defaultChecked={!!reuse} />Isi penggunaan air selama hujan</label><SourceField label="Kebutuhan penggunaan air" name="reuse" unit="m³/event" initial={reuse ?? { text: "", source: "", evidence: "USER_INPUT" }} /><small>Diambil dari air tertangkap; tidak dihitung lagi sebagai air tersimpan.</small></details>}
        <details className="source-note decision-support"><summary>{c.family === "storage" ? "Setelah tertampung, airnya untuk apa?" : "Jenis intervensi & pemeliharaan"}</summary><p>{operationalGuidance(c.family)}</p><label>{c.family === "storage" ? "Rencana penggunaan & pengosongan" : "Jenis / bahan dan rencana pemeliharaan"}<textarea key={engineeringReset} name="planningNotes" maxLength={2000} defaultValue={engineeringReset ? "" : c.planningNotes ?? ""} placeholder={c.family === "storage" ? "Misalnya: penyiraman; kapan dan siapa yang menyiapkan ruang untuk hujan berikutnya" : c.family === "infiltration" ? "Misalnya: sumur resapan / biopori; dasar kapasitas dan pemeliharaan" : c.family === "permeable" ? "Misalnya: paving bercelah; kondisi lapisan bawah dan pembersihan" : "Media, tanaman, jalur kelebihan air dan pemeliharaan"} /></label><p><a href={interventionReferences[c.family].url} target="_blank" rel="noreferrer">{interventionReferences[c.family].name}</a> · rujukan praktik; bukan kapasitas atau biaya otomatis.</p></details>
        <details className="source-note"><summary>Kondisi pemasangan · boleh belum diketahui</summary><p>Jawab untuk lokasi pemasangan yang Anda rencanakan, bukan otomatis dari zona sumber air. Jawaban tidak sesuai akan mengecualikan paket itu dari pencarian; belum diperiksa tetap menjadi syarat verifikasi.</p>{([
          ["connection", "Air dapat disalurkan ke intervensi", c.family !== "permeable"],
          ["infiltration", "Tanah / lapisan bawah sesuai untuk infiltrasi", c.family !== "storage"],
          ["plantingSpace", "Ruang media dan tanaman tersedia", c.family === "rain-garden"],
          ["surfaceChange", "Permukaan boleh diganti", c.family === "permeable"],
        ] as const).filter(([, , visible]) => visible).map(([key, label]) => <label key={key}>{label}<select aria-label={label} name={`site-${key}`} defaultValue={c.siteAssessment?.[key] ?? "unknown"}><option value="unknown">Belum diperiksa</option><option value="yes">Ya, menurut pemeriksaan / rencana saya</option><option value="no">Tidak memungkinkan / tidak sesuai</option></select></label>)}<label>Dasar kondisi lokasi<input name="site-source" maxLength={2000} defaultValue={c.siteAssessment?.source ?? ""} placeholder="Pengamatan, hasil uji, atau asumsi yang Anda nyatakan" /></label><small>Rujukan penelitian mendukung praktik, bukan membuktikan kondisi tanah MA Permata atau lokasi Anda.</small></details>
        <details className="source-note"><summary>Dasar penelitian jenis intervensi</summary><p><a href={componentReference(c).url} target="_blank" rel="noreferrer">{componentReference(c).name}</a></p><p><a href={componentResearch(c).url} target="_blank" rel="noreferrer">{componentResearch(c).name}</a></p><small>{componentResearch(c).relevance}</small>{c.family === "infiltration" && <p><a href="https://jurnal.uns.ac.id/matriks/article/view/37416" target="_blank" rel="noreferrer">Penelitian biopori · Sari, Qomariyah & Sobriyah (2014)</a> menguji tanah lanau berpasir di laboratorium. Kapasitas dan efektivitasnya tidak dapat disalin sebagai angka lokasi.</p>}</details>
        {error && <p role="alert" className="unknown-text">{error}</p>}
        <details className="changes-disclosure"><summary>Periksa perubahan angka</summary><NumberChangeSummary scope="intervensi ini" /></details>
        <small>“Simpan untuk nanti” menyimpan isian dan menonaktifkan opsi ini dari pencarian paket.</small>
      </PlanningNumberForm>
    </ContextDialog>}
  </>;
}
export function ConstraintEditor({ project, onProject, missing = false, draft = false }: { draft?: boolean; missing?: boolean; project: ProjectV2; onProject: (p: ProjectV2) => void }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return <PlanningNumberForm className="constraint-editor" fields={[
    { name: "budget", label: "Anggaran", unit: "Rp", initial: readInput(project, project.constraints.budget).text },
    { name: "land", label: "Lahan tersedia", unit: "m²", initial: readInput(project, project.constraints.usableArea).text },
  ]} onChange={() => { setError(""); setSaved(false); }} onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      onProject(savePlanningLimits(project, fromForm(f, "budget", true), fromForm(f, "land"))); setError(""); setSaved(true);
    } catch (cause) { setError(planningError(cause)); }
  }}>
    <div className="constraint-pair"><SourceField label="Anggaran" unit="Rp" name="budget" initial={readInput(project, project.constraints.budget)} missing={missing || !!error} /><SourceField label="Lahan tersedia" unit="m²" name="land" initial={readInput(project, project.constraints.usableArea)} missing={missing || !!error} /></div>
    <small>Isi batas saat siap membandingkan alternatif. Kosong = belum diketahui.</small>
    {saved && <p role="status" className="limits-saved">{draft ? "Draf diperbarui · belum diterapkan" : "Diterapkan"} · Anggaran {readInput(project, project.constraints.budget).text ? `Rp${fmt(Number(readInput(project, project.constraints.budget).text))}` : "belum diketahui"} · lahan {readInput(project, project.constraints.usableArea).text || "belum diketahui"}{readInput(project, project.constraints.usableArea).text && " m²"}</p>}
    {error && <p role="alert">{error}</p>}
    <details className="changes-disclosure"><summary>Periksa perubahan angka</summary><NumberChangeSummary scope="batas rencana" /></details>
    <button type="submit">Terapkan batas rencana</button>
  </PlanningNumberForm>;
}
export function ProjectSources({ project }: { project: ProjectV2 }) {
  return <details className="source-note"><summary>Sumber & asumsi proyek</summary><div className="source-ledger">
    <p>Limpasan = luas × hujan / 1.000 × C. Non-limpasan bukan otomatis infiltrasi. Hubungan target dinyatakan pengguna.</p>
    <CalculationSource method="runoff" />
    {project.drawingScale && <p>{project.drawingScale.source}</p>}
    {project.parameters.map(p => <p key={p.id}><strong>{p.value === null ? "Belum diketahui" : fmt(p.value)} {p.unit}</strong> · {evidenceLabel(p.evidence)}<br />{p.source || "Sumber belum tersedia"}{p.note && ` · ${p.note}`}</p>)}
  </div></details>;
}
