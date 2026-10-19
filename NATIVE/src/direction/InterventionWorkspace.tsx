import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Bookmark, MapPin, Package, SlidersHorizontal, Target, X } from "lucide-react";
import type { ProjectV2 } from "../domain/projectV2";
import type { Point } from "../domain/model";
import { Parcel } from "./Parcel";
import { fmt, type Evaluation, type OptionId, type InterventionKind } from "./productionBridge";
import { ConstraintMeters, InterventionIllustration } from "./Visuals";
import { CalculationSource } from "./CalculationSource";
import { ContextDialog } from "./ContextDialog";
import { HelpButton } from "./TirtaHelp";
import { fieldDecisionReadiness } from '../domain/fieldDecisionReadiness';
import { planningParameterValue } from '../domain/planningEngine';
import { packageResources } from '../domain/treatmentEditing';
import type { FieldDecisionAction } from '../domain/fieldDecisionReadiness';

export function InterventionArt({ kind }: { kind: InterventionKind | 'biopori' | 'porous' }) {
  return <InterventionIllustration kind={kind}/>;
}

type WaterPreview = Pick<Evaluation, 'baseline' | 'retained' | 'infiltrated' | 'reused' | 'residual'>;
export function InterventionWorkspace({ project, selected, onSelect, enabled, active, placement, palette, navigator, editor, cue, result, eventResult, contextual, selectionCue, limits, constraints, support, sources, next, onMissing, onWaterMissing, nextAction, selectionCleared = false }: {
  project: ProjectV2; selected: string; onSelect: (id: string) => void; enabled: OptionId[]; active: string;
  placement: { pending: OptionId | null; onPlace: (id: OptionId, point: Point) => void; onEdit: (id: OptionId) => void; onClear?: () => void };
  palette: ReactNode; navigator: ReactNode; editor: ReactNode; cue: ReactNode; result: Evaluation | null;
  selectionCleared?: boolean; nextAction?: FieldDecisionAction; eventResult: WaterPreview | null; contextual: ReactNode; selectionCue: ReactNode;
  limits: { budget: number | null; land: number | null }; constraints: ReactNode; support: ReactNode; sources: ReactNode; next: ReactNode; onMissing: () => void; onWaterMissing: () => void;
}) {
  const [editingLimits, setEditingLimits] = useState(false);
  const [editingSupport, setEditingSupport] = useState(false);
  const emptyWorkspace = selectionCleared || !editor;
  return <div className="intervention-atlas">
    <div className="intervention-top-composition" data-empty={emptyWorkspace ? "true" : "false"}>
      <div className="intervention-left-stack">
      <section className="intervention-dock"><header className="palette-heading"><h2>Tambah penanganan</h2><button className="btn-secondary btn-compact" onClick={() => setEditingSupport(true)}><SlidersHorizontal size={16}/>Paket & kondisi</button></header><p>Pilih jenis, lalu tentukan sumber air dan lokasi pemasangannya.</p>{palette}<div className="placed-heading"><h3>Sedang dipertimbangkan</h3><span>{enabled.length} penanganan</span></div>{navigator}</section>
      <section className="intervention-preview" aria-label="Persil dan intervensi">{selectionCue}{cue}<Parcel project={project} selected={selected} onSelect={onSelect} enabled={enabled} placement={placement} compact fit materialTextures detailLabels illustratedMarkers roleSelecting={!!selectionCue} activeIntervention={active}/>{contextual}</section>
      </div>
      <aside className="active-intervention-editor" aria-label="Intervensi terpilih"><div hidden={selectionCleared}>{editor}</div>{(selectionCleared || !editor) && <div className="inspector-empty"><SlidersHorizontal size={34}/><h2>Pilih satu intervensi</h2><p>Klik simbol atau nama penanganan untuk melanjutkan. Isian terakhir tetap ada.</p></div>}</aside>
    </div>
    <section className={`intervention-ledger-region ${eventResult?'has-result':'is-blocked'}`} aria-label="Dampak komposisi">
      <div className="intervention-water-ledger"><header><h2>Dampak intervensi</h2><HelpButton topic="interventions" label="Neraca air"/></header>
        {eventResult ? <><div className="ledger-before"><span>Limpasan awal <small>(sebelum intervensi)</small><strong>{fmt(eventResult.baseline.runoffM3)} m³</strong></span><i/></div><ArrowDown className="ledger-arrow" size={22}/><CompositionLedger result={eventResult}/><div className="ledger-notes"><CalculationSource method="ledger"/></div></> : <div className="ledger-blocked-state" role="status"><div><h3>Belum dihitung</h3><p>{nextAction?.message ?? 'Lengkapi data yang diperlukan untuk menghitung dampak.'}</p></div><button className="btn-secondary btn-compact" onClick={onWaterMissing}>{nextAction?.label ?? 'Periksa data'}<ArrowRight size={16}/></button></div>}<div className="ledger-sources-inline">{sources}</div>
      </div>
      <div className="intervention-limit-summary"><header><h3>Biaya dan lahan</h3><button className="btn-secondary btn-compact" onClick={() => setEditingLimits(true)}>Ubah batas</button></header><ConstraintMeters result={result} limits={limits} resources={packageResources(project)}/>{limits.budget === null || limits.land === null ? <p className="limits-next-cue">Isi anggaran dan lahan sebelum mencari alternatif.</p> : null}<div className="ledger-next">{next}<button className="text-button ledger-readiness" onClick={onMissing}>Periksa kesiapan <ArrowRight size={16}/></button></div></div>
    </section>
    {editingLimits && <ContextDialog title="Batas rencana Anda" className="planning-limits-dialog" leading={<span className="planning-limits-dialog-icon" aria-hidden="true"><SlidersHorizontal size={20}/></span>} onClose={() => setEditingLimits(false)}>{constraints}</ContextDialog>}
    {editingSupport && <ContextDialog title="Paket & kondisi" className="planning-support-dialog" leading={<span className="planning-support-dialog-icon" aria-hidden="true"><SlidersHorizontal size={20}/></span>} onClose={() => setEditingSupport(false)}>{support}</ContextDialog>}
  </div>;
}

function CompositionLedger({ result }: { result: WaterPreview }) {
  const [active, setActive] = useState<string | null>(null);
  const total = result.baseline.runoffM3;
  const parts = [
    { name: "Ditampung", value: result.retained, color: "#007da3", note: "Air yang masih tersimpan pada akhir kejadian." },
    { name: "Digunakan kembali", value: result.reused, color: "#756292", note: "Diambil dari air tertangkap selama kejadian; tidak dihitung dua kali." },
    { name: "Diinfiltrasikan", value: result.infiltrated, color: "#417f4d", note: "Volume tambahan berdasarkan kapasitas yang Anda nyatakan." },
    { name: "Sisa limpasan", value: result.residual, color: "#526f82", note: "Sisa air setelah intervensi; bukan kedalaman genangan." },
  ];
  const reading = parts.find(p => p.name === active);
  return <div className="composition-ledger">
    <div className="composition-rail" role="img" aria-label={parts.map(p => `${p.name}: ${fmt(p.value)} m³`).join("; ")}>{parts.map(p => <span key={p.name} title={`${p.name}: ${fmt(p.value)} m³`} style={{ width: `${total > 0 ? p.value / total * 100 : 0}%`, background: p.color }}>{total > 0 && p.value / total >= .16 && <><strong>{fmt(p.value)} m³</strong><small>({fmt(p.value / total * 100)}%)</small></>}</span>)}</div>
    <div className="composition-legend">{parts.filter(p => p.name !== "Digunakan kembali" || p.value > 0).map(p => <button key={p.name} aria-pressed={active === p.name} onClick={() => setActive(active === p.name ? null : p.name)}><i style={{background:p.color}}/><span>{p.name}<strong>{fmt(p.value)} m³</strong></span></button>)}</div>
    {reading && <p className="composition-reading" role="status">{reading.note}</p>}{total === 0 && <p className="composition-reading">Volume kejadian ini nol.</p>}
  </div>;
}

export function InterventionNavigator({ project, scenario, active, onSelect, onEdit, onRemove, onDelete, onPlace, onDuplicate }: { project: ProjectV2; scenario:string; active: string; onSelect: (id: OptionId) => void; onEdit: (id: OptionId) => void; onRemove: (id: OptionId) => void; onDelete: (id: OptionId) => void; onPlace: (id: OptionId) => void; onDuplicate: (id: OptionId) => void }) {
  const [query, setQuery] = useState("");
  const [actions,setActions]=useState<string|null>(null);
  const actionItem=project.components.find(c=>c.id===actions);
  const items = project.components.filter(c => c.enabled);
  const states=fieldDecisionReadiness(project,scenario).treatments;
  const drafts = project.components.filter(c=>!c.enabled);
  return <>{items.length > 6 && <label className="instance-search">Cari intervensi<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label>}<div className="intervention-instance-list">{items.filter(c => c.name.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID"))).map(c => {
    const id = c.id as OptionId;
    const kind = c.family === "storage" ? "tank" : c.family === "infiltration" ? c.infiltrationType === "biopori" ? "biopori" : "soak" : c.family === "rain-garden" ? "garden" : "porous";
    const state=states.find(row=>row.id===id);
    const resource=(field:'totalCost'|'occupiedArea',unit:'IDR'|'m2')=>{try{return planningParameterValue(project.parameters,c[field],unit,c.name);}catch{return null;}};
    const cost=resource('totalCost','IDR'),area=resource('occupiedArea','m2');
    return <div key={id} className={`intervention-option ${active === id ? "selected" : ""}`} data-component={id}>
      <button className="instance-select" aria-pressed={active === id} onClick={() => onSelect(id)}><InterventionArt kind={kind}/><span><strong>{c.name}</strong><small>{project.zones.find(z=>z.id===c.treatment?.installationZoneId)?.name??"Lokasi belum dipilih"}</small><small>{state?.calculationReady?"Dampak air dapat dihitung":state?.calculationActions[0]?.label??"Perlu data hitungan air"}</small><small>{cost===null?"Biaya belum diketahui":`Rp${fmt(cost)}`} · {area===null?"Ruang belum diketahui":`${fmt(area)} m²`}</small></span></button>
      <button className="instance-menu-trigger" aria-label={`Tindakan ${c.name}`} aria-haspopup="dialog" onClick={()=>setActions(id)}>⋮</button>
    </div>;
  })}</div>{drafts.length>0 && <details className="deferred-treatments"><summary>Disimpan untuk nanti ({drafts.length})</summary><div>{drafts.map(c => <button key={c.id} type="button" onClick={() => onSelect(c.id)}><span title={c.name}>{c.name}</span>Lanjutkan isian</button>)}</div></details>}{!items.length && <p className="planning-empty">Belum ada intervensi. Pilih jenis di atas.</p>}{items.length > 0 && !items.some(c => c.name.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID"))) && <p>Tidak ada intervensi yang cocok.</p>}
    {actionItem && <ContextDialog title={actionItem.name} className="instance-action-dialog" onClose={()=>setActions(null)}><div className="instance-action-options">
      <button onClick={()=>{setActions(null);onEdit(actionItem.id);}}>Atur intervensi<ArrowRight size={17}/></button>
      <button onClick={()=>{setActions(null);onPlace(actionItem.id);}}>{actionItem.placement?'Pindahkan simbol':'Letakkan di persil'}<ArrowRight size={17}/></button>
      {actionItem.family!=='permeable' && <button onClick={()=>{setActions(null);onDuplicate(actionItem.id);}}>Buat salinan<ArrowRight size={17}/></button>}
      <button onClick={()=>{setActions(null);onRemove(actionItem.id);}}>Simpan untuk nanti<ArrowRight size={17}/></button>
      <button className="btn-danger" onClick={()=>{setActions(null);onDelete(actionItem.id);}}><X size={17}/>Hapus penanganan</button>
    </div></ContextDialog>}
  </>;
}

export function PlanningSupport({ packages, conditions, variants, intent }: { packages: ReactNode; conditions: ReactNode; variants: ReactNode; intent: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const topics = [
    { id: "packages", name: "Siapkan paket", description: "Rangkai kombinasi intervensi yang ingin diuji.", Icon: Package, content: packages },
    { id: "conditions", name: "Kesesuaian persil", description: "Periksa kondisi lahan yang mendukung atau membatasi.", Icon: MapPin, content: conditions },
    { id: "variants", name: "Varian tersimpan", description: "Simpan konfigurasi agar mudah dibuka dan dibandingkan.", Icon: Bookmark, content: variants },
    { id: "intent", name: "Prioritas rencana", description: "Nyatakan tujuan yang perlu dijaga saat membandingkan.", Icon: Target, content: intent },
  ];
  const selected = topics.find(topic => topic.id === active);
  return <div className="planning-support-shell">
    <div className="planning-support-intro"><span>Pengaturan paket</span><p>Atur komposisi, kesesuaian persil, varian, dan prioritas dari satu tempat.</p></div>
    <div className="planning-support-actions">{topics.map(({ id, name, description, Icon }) => <button key={id} className={active === id ? "is-active" : undefined} aria-expanded={active === id} aria-controls="planning-support-content" onClick={() => setActive(active === id ? null : id)}>
      <span className="planning-support-card-icon" aria-hidden="true"><Icon size={20}/></span><span className="planning-support-card-copy"><strong>{name}</strong><small>{description}</small></span><ArrowRight className="planning-support-card-arrow" size={18} aria-hidden="true"/>
    </button>)}</div>
    {selected && <section id="planning-support-content" className="planning-support-content" aria-label={selected.name}><header><selected.Icon size={18} aria-hidden="true"/><span><strong>{selected.name}</strong><small>{selected.description}</small></span></header><div className="planning-support-content-body">{selected.content}</div></section>}
  </div>;
}
