import { useState } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import { saveRain } from "../domain/planningAuthoring";
import { numericInput } from "../domain/validation";
import { ContextDialog } from "./ContextDialog";
import './rain-test-presets.css';

export const rainAssumptionSource = "Skenario uji yang ditentukan pengguna, bukan prediksi cuaca.";

export function RainTemplates({ project, onApply, label = "+ Buat template hujan" }: { label?: string; project: ProjectV2; onApply: (project: ProjectV2, scenario: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error,setError]=useState('');
  const fresh=project.scenarios.every(s=>project.parameters.find(p=>p.id===s.rainfall.id)?.value==null);
  const preset=(depth:number)=>{
    try{
      const unknown=project.scenarios.find(s=>project.parameters.find(p=>p.id===s.rainfall.id)?.value==null);
      const id=unknown?.id??crypto.randomUUID();
      onApply(saveRain(project,id,`Hujan uji ${depth} mm`,{text:String(depth),evidence:project.mode==='demo'?'DEMO':'ASSUMPTION',source:'Angka contoh yang dipilih pengguna untuk menguji aplikasi; bukan data hujan lokasi.'},'Skenario uji, bukan hujan terukur.'),id);
    }catch(cause){setError(cause instanceof Error?cause.message:'Skenario belum diterapkan.');}
  };
  return <>{fresh&&<div className="fresh-rain-presets" role="group" aria-label="Contoh hujan untuk pengujian"><span>Gunakan hujan uji</span><button type="button" onClick={()=>preset(50)}>50 mm</button><button type="button" onClick={()=>preset(100)}>100 mm</button><small>Bukan data hujan lokasi.</small></div>}
    <button aria-label={label} className="text-button rain-template-trigger" disabled={project.scenarios.length >= 30} onClick={() => setOpen(true)}>{label}</button>
    {error&&<p role="alert">{error}</p>}
    {open && <TemplateForm project={project} onClose={() => setOpen(false)} onApply={(p, id) => { onApply(p, id); setOpen(false); }} />}
  </>;
}
function TemplateForm({ project, onApply, onClose }: { project: ProjectV2; onApply: (project: ProjectV2, scenario: string) => void; onClose: () => void }) {
  const maximum = 30 - project.scenarios.length;
  const [count, setCount] = useState(String(Math.min(2, maximum)));
  const [rows, setRows] = useState<Array<{ name: string; depth: string }>>([]);
  const [source, setSource] = useState("");
  const [basis, setBasis] = useState("assumption");
  const [error, setError] = useState("");
  const n = Number(count);
  const validCount = Number.isInteger(n) && n >= 1 && n <= maximum;
  return <ContextDialog title="Template hujan Anda" onClose={onClose}><form className="rain-template-form" onSubmit={e => {
    e.preventDefault(); setError("");
    if (!validCount) { setError(`Pilih jumlah antara 1 dan ${maximum}.`); return; }
    if (basis === "reference" && !source.trim()) { setError("Isi sumber data hujan, atau pilih Skenario uji saya."); return; }
    try {
      let p = project; const ids: string[] = [];
      for (let i = 0; i < n; i++) {
        const row = rows[i]; const depth = row?.depth ?? "";
        const parsed = numericInput(depth);
        if (!parsed.ok || parsed.value === null) throw new Error(`Isi kedalaman hujan untuk template ${i + 1}; nol boleh, kosong belum diketahui.`);
        const id = crypto.randomUUID(); ids.push(id);
        p = saveRain(p, id, row?.name.trim() || `Hujan ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(parsed.value)} mm`, { text: depth, evidence: basis === "assumption" ? "ASSUMPTION" : "USER_INPUT", source: basis === "assumption" ? `${rainAssumptionSource}${source.trim() ? ` ${source.trim()}` : ""}` : source.trim() }, "Satu kejadian hujan untuk skenario pra-perencanaan.");
      }
      onApply(p, ids[0]!);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Template belum tersimpan."); }
  }}>
    <p>Tambahkan skenario sesuai kedalaman hujan yang ingin diuji. Skenario tersedia di Hujan dan Intervensi.</p>
    <div className="fresh-rain-presets" role="group" aria-label="Contoh pasangan hujan"><button type="button" onClick={()=>{setCount(String(Math.min(2,maximum)));setRows([{name:'Hujan uji 50 mm',depth:'50'},{name:'Hujan uji 100 mm',depth:'100'}]);setBasis('assumption');setSource('Angka contoh, bukan pengukuran hujan lokasi.');}}>Isi contoh 50 / 100 mm</button><small>Tetap dapat diubah sebelum dibuat.</small></div>
    <label>Jumlah template baru<input aria-label="Jumlah template baru" type="number" min="1" max={maximum} step="1" required value={count} onChange={e => setCount(e.target.value)} /></label>
    <div className="rain-template-rows">{Array.from({ length: validCount ? n : 0 }, (_, i) => <div key={i}>
      <label>Nama template {i + 1}<input maxLength={120} placeholder="Mis. hujan ringan" value={rows[i]?.name ?? ""} onChange={e => setRows(prev => { const next = [...prev]; next[i] = { name: e.target.value, depth: prev[i]?.depth ?? "" }; return next; })} /></label>
      <label>Hujan {i + 1} (mm)<input type="number" min="0" step="any" required value={rows[i]?.depth ?? ""} onChange={e => setRows(prev => { const next = [...prev]; next[i] = { name: prev[i]?.name ?? "", depth: e.target.value }; return next; })} /></label>
    </div>)}</div>
    <label>Dasar hujan<select value={basis} onChange={e => setBasis(e.target.value)}><option value="assumption">Skenario uji saya</option><option value="reference">Data / referensi hujan</option></select></label>
    <label>{basis === "reference" ? "Sumber data hujan" : "Catatan"}<input key={basis} required={basis === "reference"} maxLength={1500} value={source} onChange={e => setSource(e.target.value)} /></label>
    <small>Angka tidak diisi otomatis. “Skenario uji saya” disimpan sebagai asumsi, bukan hujan terukur. Isi kapasitas intervensi untuk setiap skenario hujan.</small>
    {error && <p role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={!validCount}>Buat {validCount ? n : ""} skenario</button>
  </form></ContextDialog>;
}
