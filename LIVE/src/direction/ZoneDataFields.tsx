import { useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, FileText, Pencil } from "lucide-react";
import type { ProjectV2 } from "../domain/projectV2";
import { surfaceLabels } from "../domain/model";
import { coefficientGuidance, coefficientPicks, coefficientChoiceSource, coefficientMethodNote, outsideGuidance } from "../domain/coefficientGuidance";
import { ContextDialog } from "./ContextDialog";
import { HelpButton } from "./TirtaHelp";
import { z } from "zod";
import { numericInput } from "../domain/validation";
import "./coefficient-picker.css";

// Coefficients need their actual precision: 0.175 must not appear as 0.18.
const fmt = (value: number) => String(value).replace(".", ",");

export function ZoneDataFields({ project, zone, onApply, missing = false }: {
  project: ProjectV2; zone: ProjectV2["zones"][number]; missing?: boolean;
  onApply: (data: { coefficientRaw: string; coefficientSource: string; nameRaw?: string; surfaceContext?: string; poreType?: "unknown" | "natural" | "manufactured" }) => boolean;
}) {
  const coefficient = project.parameters.find(p => p.id === zone.coefficient.id)!;
  const guidance = zone.surface ? coefficientGuidance[zone.surface] : null;
  const initialRange = guidance?.ranges.findIndex(range => coefficientPicks(range).some(pick => coefficient.value === pick.value && coefficient.source === coefficientChoiceSource(zone.surface!, range, pick.value))) ?? -1;
  const [text, setText] = useState(coefficient.value === null ? "" : String(coefficient.value));
  const [source, setSource] = useState(coefficient.source);
  const [mode, setMode] = useState<"reference" | "custom">(initialRange >= 0 || (coefficient.value === null && guidance?.ranges.length) ? "reference" : "custom");
  const [activeRange, setActiveRange] = useState(Math.max(initialRange, 0));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const customInput = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const normalizedText = text.trim().replace(",", ".").replace(/^\./, "0.");
  const parsed = numericInput(normalizedText);
  const outOfRange = parsed.ok && parsed.value !== null && outsideGuidance(zone.surface, parsed.value);
  const formId = `zone-data-${zone.id}`;
  const chosen = parsed.ok && parsed.value !== null && parsed.value <= 1;
  const referenceChosen = !!guidance?.ranges.some(range => coefficientPicks(range).some(pick => text === String(pick.value) && source === coefficientChoiceSource(zone.surface!, range, pick.value)));
  return <>
    <div className="coefficient-entry">
      <button className="coefficient-launch" data-focus="coefficient" aria-haspopup="dialog" aria-expanded={open} aria-describedby={missing ? "coefficient-entry-help" : undefined} onClick={() => { setError(""); setOpen(true); }}>
        <BookOpen size={22} aria-hidden="true"/><span><strong>Pilih dari patokan</strong><small>{coefficient.value === null ? "Belum dipilih" : `Koefisien limpasan: ${fmt(coefficient.value)} · ${initialRange >= 0 ? "Patokan" : "Nilai custom"}`}</small></span><ChevronRight size={20} aria-hidden="true"/>
      </button>
      <HelpButton topic="coefficient" label="Apa arti koefisien limpasan?" compact />
      {missing && <small id="coefficient-entry-help" className="coefficient-required">Pilih patokan atau isi nilai custom untuk menghitung limpasan.</small>}
    </div>
    {open && <ContextDialog className="coefficient-picker" title="Pilih dari patokan" footer={<><div className="coefficient-selection"><small>Nilai dipilih</small><strong>{chosen && (mode === "custom" || referenceChosen) ? `Koefisien ${fmt(parsed.value!)}` : mode === "reference" ? "Belum dipilih" : "Belum diketahui"}</strong></div><button className="primary" type="submit" form={formId} disabled={mode === "reference" && !referenceChosen}>Terapkan<ArrowRight size={18}/></button></>} onClose={() => setOpen(false)}>
      <form id={formId} noValidate onSubmit={e => {
        e.preventDefault();
        if (text.trim() !== "" && !chosen) { setError("Isi nilai antara 0 dan 1, dengan koma atau titik desimal."); customInput.current?.focus(); return; }
        if (text !== "" && !source.trim()) { setError("Tulis sumber atau alasan pemilihan angka."); sourceInput.current?.focus(); return; }
        if (mode === "reference" && !referenceChosen) { setError("Pilih nilai dari salah satu patokan."); return; }
        const f = new FormData(e.currentTarget);
        const success = onApply({ coefficientRaw: normalizedText, coefficientSource: source, nameRaw: String(f.get("name") ?? zone.name), surfaceContext: String(f.get("surfaceContext") ?? zone.surfaceContext ?? ""), poreType: zone.surface === "porous" ? z.enum(["unknown", "natural", "manufactured"]).parse(f.get("poreType")) : undefined });
        if (success) setOpen(false); else setError("Data belum diterapkan. Periksa nilai dan sumbernya.");
      }}>
        <p className="coefficient-zone">{zone.name} · {zone.surface ? surfaceLabels[zone.surface] : "Jenis permukaan belum dipilih"}</p>
        <div className="coefficient-modes" role="group" aria-label="Cara menentukan koefisien">
          <button type="button" aria-pressed={mode === "reference"} onClick={() => { setMode("reference"); setError(""); }}><BookOpen size={20}/>Patokan</button>
          <button type="button" aria-pressed={mode === "custom"} onClick={() => { setMode("custom"); setError(""); }}><Pencil size={20}/>Isi custom</button>
        </div>
        {mode === "reference" && <section className="coefficient-reference-list" aria-label="Patokan koefisien">
          {guidance?.ranges.map((range, index) => <div className={`coefficient-reference-row ${activeRange === index ? "is-active" : ""}`} key={range.label}>
            <button type="button" className="coefficient-range-select" aria-expanded={activeRange === index} aria-controls={`${formId}-range-${index}`} onClick={() => { setActiveRange(index); setError(""); if (referenceChosen && !coefficientPicks(range).some(pick => text === String(pick.value) && source === coefficientChoiceSource(zone.surface!, range, pick.value))) { setText(""); setSource(""); } }}>
              <span className="coefficient-radio" aria-hidden="true">{activeRange === index && <span/>}</span><strong>{range.label}</strong><span className="coefficient-range-badge">{fmt(range.low)}–{fmt(range.high)}</span>
            </button>
            <div id={`${formId}-range-${index}`} hidden={activeRange !== index} className="coefficient-value-options">{coefficientPicks(range).map(pick => <button type="button" key={pick.label} aria-pressed={text === String(pick.value) && source === coefficientChoiceSource(zone.surface!, range, pick.value)} onClick={() => { setText(String(pick.value)); setSource(coefficientChoiceSource(zone.surface!, range, pick.value)); setError(""); }} aria-label={`${range.label}: ${pick.label} · C ${fmt(pick.value)}`}><span>{pick.label === "Tengah rentang" ? "Tengah" : pick.label}</span><b>{fmt(pick.value)}</b></button>)}</div>
          </div>)}
          {!guidance?.ranges.length && <div className="coefficient-no-reference"><strong>{zone.surface ? "Tidak ada patokan angka universal untuk permukaan ini." : "Pilih jenis permukaan agar patokannya tersedia."}</strong><button type="button" className="text-button" onClick={() => setMode("custom")}>Isi custom<ArrowRight size={16}/></button></div>}
          {referenceChosen && <p className="coefficient-reference-confirmation"><Check size={16}/>Pilihan menjadi asumsi perhitungan setelah diterapkan.</p>}
        </section>}
        {mode === "custom" && <div className="coefficient-custom-fields">
          <label>Koefisien untuk perhitungan<input ref={customInput} name="coefficient" aria-label="Koefisien untuk perhitungan" type="text" inputMode="decimal" value={text} onChange={e => { setText(e.target.value); setError(""); if (source.startsWith("Pilihan pengguna C=")) setSource(""); }} placeholder="Belum diketahui" aria-invalid={text !== "" && !chosen || undefined} aria-describedby="coefficient-custom-help" /></label>
          <small id="coefficient-custom-help">0–1. Kosong berarti belum diketahui.</small>
          {outOfRange && <p className="field-warning" role="status">Di luar rentang patokan. Gunakan hanya jika ada dasar yang sesuai.</p>}
          <label>Sumber koefisien<input ref={sourceInput} name="source" value={source} onChange={e => { setSource(e.target.value); setError(""); }} maxLength={2000} placeholder="Referensi atau alasan pemilihan angka" aria-invalid={!!error && text !== "" && !source.trim() || undefined} /></label>
        </div>}
        {guidance && <details className="coefficient-source-detail"><summary><FileText size={19}/>Sumber & batas penggunaan<ChevronRight size={18}/></summary><a href={guidance.url} target="_blank" rel="noreferrer">{guidance.source}</a><p>{guidance.note}</p>{guidance.ranges.length > 0 && <p>{coefficientMethodNote}</p>}{mode === "reference" && referenceChosen && <p className="coefficient-chosen-source">{source}</p>}</details>}
        <details className="coefficient-zone-details"><summary>Data zona lainnya</summary><label>Nama zona<input name="name" defaultValue={zone.name} required maxLength={120} /></label>
          {zone.surface === "porous" && <><label>Asal pori / celah permukaan<select aria-label="Asal pori / celah permukaan" name="poreType" defaultValue={zone.poreType ?? "unknown"}><option value="unknown">Belum diketahui</option><option value="natural">Pori tanah alami</option><option value="manufactured">Material / celah buatan</option></select></label><label>Bahan / kondisi<input name="surfaceContext" maxLength={2000} defaultValue={zone.surfaceContext ?? ""} placeholder="Bahan dan kondisi yang diketahui" /></label><small>Asal pori tidak menetapkan koefisien atau kapasitas infiltrasi.</small></>}
        </details>
        {error && <p role="alert" className="field-error">{error}</p>}
      </form>
    </ContextDialog>}
  </>;
}
