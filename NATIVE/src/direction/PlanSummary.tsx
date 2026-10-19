import { useState } from "react";
import { ArrowRight, ChevronRight, Cylinder, Sprout, Grid3X3, ArrowDownToDot, Droplets, Download, CircleCheckBig, ClipboardCheck, TrendingUp } from "lucide-react";
import type { ProjectV2 } from "../domain/projectV2";
import { type Plan } from "../domain/planningEngine";
import { fmt, money, componentEditorValues, type Evaluation, type Limits, type OptionId } from "./productionBridge";
import { decisionInterpretation } from "./decisionFeedback";
import { PlanWaterFlow } from "./PlanWaterFlow";
import { ConstraintMeters } from "./Visuals";
import { Parcel } from "./Parcel";
import { ContextDialog } from "./ContextDialog";
import {planImplementationChecks,planScenarioOutcomes,planDeclaredPaths,type PlanCheck} from '../domain/planClosure';
import { planRecommendation } from '../domain/packageRecommendations';
import { resourceLimitStatus } from '../domain/resourceLimits';

const familyIcons={ storage:Cylinder, infiltration:ArrowDownToDot, "rain-garden":Sprout, permeable:Grid3X3 };
export function PlanTargets({ project, plan }: { project:ProjectV2; plan:Plan }) {
  return <section className="plan-targets"><h3>Sumber air & isi paket</h3>{plan.components.some(c=>c.enabled)&&<p>Zona sumber dipilih pengguna. Posisi simbol tidak menunjukkan sambungan air.</p>}
    <div className="plan-target-rows" tabIndex={0} role="region" aria-label="Sumber dan intervensi paket">{plan.components.filter(c=>c.enabled).map(c => {
      const Icon=familyIcons[c.family];
      return <div key={c.id}><span>{c.targets.map(id=>project.zones.find(z=>z.id===id)?.name ?? "Zona terhapus").join(", ") || "Target belum dinyatakan"}</span><ArrowRight size={18} aria-hidden="true"/><Icon size={26} aria-hidden="true"/><strong>{c.name}</strong></div>;
    })}</div>
    {!plan.components.some(c=>c.enabled) && <p>Kondisi awal tanpa intervensi.</p>}
  </section>;
}
export function PlanScenarioRows({ project,plan,scenario,onScenario }: {project:ProjectV2;plan:Plan;scenario:string;onScenario:(id:string)=>void}) {
  return <section className="plan-scenario-compact" aria-label="Hasil rencana per skenario"><h3>Hasil per skenario hujan</h3><div tabIndex={0} role="region" aria-label="Daftar skenario rencana">{planScenarioOutcomes(project,plan).map(outcome=>{
    return <button key={outcome.id} aria-pressed={scenario===outcome.id} onClick={()=>onScenario(outcome.id)} title={outcome.name}>
      <span>{outcome.ok ? `${fmt(outcome.rain)} mm` : outcome.name}</span>
      <strong>{outcome.ok ? `${fmt(outcome.baseline)} → ${fmt(outcome.residual)} m³` : "Belum dapat dinilai"}</strong>
      {outcome.ok ? <><i aria-hidden="true"><b style={{width:`${outcome.percent??0}%`}}/></i><small>{fmt(outcome.handled)} m³ tertangani{outcome.percent!==null&&` · ${fmt(outcome.percent)}%`}</small></> : <small>{outcome.reasons.join(' ')}</small>}
    </button>;
  })}</div></section>;
}

export function PlanRecommendationPanel({project,plan,scenario,stale=false}:{project:ProjectV2;plan:Plan;scenario:string;stale?:boolean}) {
  const [showAllChecks,setShowAllChecks]=useState(false);
  if(stale)return <section className="plan-recommendation" aria-labelledby="plan-recommendation-title"><header className="plan-recommendation-hero"><span>REKOMENDASI DITAHAN</span><h3 id="plan-recommendation-title">Tinjau ulang rencana setelah perubahan input.</h3><p>Rencana pilihan tetap tersimpan, tetapi rekomendasi tidak dihitung ulang sampai Anda meninjau dan memilih kembali berdasarkan data terbaru.</p></header></section>;
  const recommendation=planRecommendation(project,plan,scenario);
  const visibleActions=showAllChecks?recommendation.actions:recommendation.actions.slice(0,6);
  return <section className="plan-recommendation" aria-labelledby="plan-recommendation-title">
    <header className="plan-recommendation-hero">
      <span>REKOMENDASI BERDASARKAN RENCANA PILIHAN</span>
      <h3 id="plan-recommendation-title">{recommendation.headline}</h3>
      <p>{recommendation.summary}</p>
    </header>
    {recommendation.userReason&&<div className="plan-recommendation-reason"><strong>Alasan pilihan Anda</strong><p>{recommendation.userReason}</p></div>}
    <div className="plan-recommendation-grid">
      <section><h4><CircleCheckBig size={20}/>Kenapa pilihan ini masuk akal</h4><ul>{recommendation.strengths.map(item=><li key={item}>{item}</li>)}</ul></section>
      <section><h4><ClipboardCheck size={20}/>Prioritas sebelum diterapkan</h4>{recommendation.actions.length?<><ol>{visibleActions.map(item=><li key={`${item.title}-${item.detail}`}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ol>{recommendation.actions.length>6&&<button type="button" className="text-button plan-recommendation-check-toggle" onClick={()=>setShowAllChecks(value=>!value)}>{showAllChecks?'Tampilkan 6 prioritas':`Lihat semua ${recommendation.actions.length} pemeriksaan`}</button>}</>:<p>Tidak ada pemeriksaan tambahan yang dibangkitkan dari data rencana saat ini.</p>}</section>
    </div>
    <div className="plan-recommendation-grid plan-recommendation-secondary">
      <section><h4><Droplets size={20}/>Ketahanan pada skenario hujan</h4><ul>{recommendation.scenarioNotes.map(item=><li key={item}>{item}</li>)}</ul></section>
      <section><h4><TrendingUp size={20}/>Jika ingin meningkatkan hasil</h4>{recommendation.improvement.length?<ul>{recommendation.improvement.map(item=><li key={item}>{item}</li>)}</ul>:<p>Tidak ada fokus tambahan yang muncul dari sisa limpasan pada skenario aktif.</p>}</section>
    </div>
  </section>;
}
export function PlanSummary({ project,plan,result,limits,scenario,onScenario,onExplain,onCheck,onExport,onCompare,stale=false }: { project:ProjectV2;plan:Plan;result:Evaluation;limits:Limits;scenario:string;onScenario:(id:string)=>void;onExplain:()=>void;onCheck:(check:PlanCheck)=>void;onExport:()=>void;onCompare:()=>void;stale?:boolean }) {
  const [selected,setSelected]=useState<string|null>(null);
  const components=plan.components.filter(c=>c.enabled);
  // Frozen composition is for presentation; calculations need the complete registry.
  const displayProject={...project,components:plan.components,parameters:[...project.parameters.filter(p=>!plan.parameters.some(saved=>saved.id===p.id)),...plan.parameters]};
  const active=components.find(c=>c.id===selected);
  const values=active ? componentEditorValues(displayProject,active.id as OptionId,scenario) : null;
  const impact=decisionInterpretation(result.baseline.runoffM3,result.residual);
  const handledParts=[
    {value:result.retained,label:'menahan air dalam tampungan'},
    {value:result.infiltrated,label:'meresapkan air ke tanah'},
    {value:result.reused,label:'memanfaatkan air selama kejadian'},
  ].filter(item=>item.value>1e-9).sort((a,b)=>b.value-a.value);
  const flowInsight=impact.handled<=1e-9
    ? 'Rencana ini belum mengurangi volume limpasan pada hujan aktif. Periksa kapasitas dan sumber air yang dialokasikan.'
    : `${handledParts.length>1?'Rencana ini menggabungkan beberapa cara penanganan dan terutama ': 'Rencana ini terutama '}${handledParts[0]?.label??'menangani air sesuai kapasitas yang dinyatakan'}. ${result.residual>1e-9?'Sisa limpasan tetap memerlukan jalur keluar yang diperiksa di lapangan; diagram ini bukan prediksi genangan.':'Neraca volume pada skenario ini tidak menyisakan limpasan, tetapi kondisi lapangan tetap perlu diverifikasi; ini bukan jaminan bebas genangan.'}`;
  const checks=planImplementationChecks(project,plan,scenario);
  const paths=planDeclaredPaths(project,plan);
  const resourceStatus=resourceLimitStatus({cost:result.cost,area:result.area},limits);
  const resourceBlocked=!resourceStatus.withinKnownLimits;
  const editNote=()=>{onExplain();requestAnimationFrame(()=>{const details=[...document.querySelectorAll<HTMLDetailsElement>('.decision-conclusion details')].find(d=>d.querySelector('textarea'));if(details){details.open=true;details.querySelector('textarea')?.focus();details.scrollIntoView({block:'nearest'});}});};
  return <div className="decision-canvas plan-summary">
    <div className="plan-result-visual">
      {!components.length && <p className="plan-baseline-choice">Anda memilih kondisi awal tanpa penanganan. Ini bukan rekomendasi otomatis.</p>}
      <PlanWaterFlow result={result}/>
      <div className="plan-flow-insight"><strong>Makna cepat</strong><p>{flowInsight}</p></div>
      <div className="plan-impact-strip"><Droplets size={36} aria-hidden="true"/><div><strong>{impact.share===null ? "0 m³" : `${new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(impact.share*100)}%`}</strong><span>{impact.share===null ? "Limpasan awal pada hujan ini" : "limpasan tertangani"}</span></div><div><span>Masih tersisa</span><strong>{fmt(result.residual)} <small>m³</small></strong></div><p>Neraca satu kejadian hujan; bukan prediksi genangan.</p></div>
    </div>
    <aside className="plan-composition" aria-label="Komposisi rencana pilihan">
      <header><h3>Paket pada persil</h3><button className="text-button" onClick={onExplain}>Lihat isi paket<ArrowRight size={16}/></button></header>
      <Parcel project={displayProject} selected="" enabled={components.map(c=>c.id as OptionId)} compact fit materialTextures detailLabels/>

      {paths.length>0&&<div className="plan-declared-paths" aria-label="Jalur air yang dinyatakan">{paths.map(c=><div key={c.id}>{c.paths.map((path,index)=><p key={index}>{path.source}<span aria-hidden="true"> → </span>{path.connected?<>{path.steps.join(' → ')} → {c.name}</>:<>Sambungan ke {c.name} belum diperiksa</>}</p>)}<small>{c.overflow}</small></div>)}</div>}
      <div className="plan-options" tabIndex={0} role="region" aria-label="Intervensi dalam paket">{components.map(c=>{
        const Icon=familyIcons[c.family];
        return <button className="plan-option" key={c.id} onClick={()=>setSelected(c.id)}><Icon size={30} aria-hidden="true"/><span><strong>{c.name}</strong><small>Target: {c.targets.map(id=>project.zones.find(z=>z.id===id)?.name ?? "Zona terhapus").join(", ") || "belum dinyatakan"}</small></span><ChevronRight size={18} aria-hidden="true"/></button>;
      })}{!components.length && <p>Kondisi awal tanpa intervensi.</p>}</div>
    </aside>
    <div className="plan-summary-bottom">
      <section><h3>Biaya & lahan</h3><ConstraintMeters result={result} limits={limits}/></section>
      <section className="plan-result-meaning"><h3>Makna untuk rencana ini</h3><div className="plan-meaning-metrics"><div className="is-handled"><Droplets size={34} aria-hidden="true"/><div><strong>{fmt(impact.handled)} <small>m³</small></strong><span>tertangani ({impact.share===null?'0':fmt(impact.share*100)}%)</span></div></div><div className="is-residual"><Droplets size={34} aria-hidden="true"/><div><strong>{fmt(result.residual)} <small>m³</small></strong><span>masih tersisa ({result.baseline.runoffM3>0?fmt(result.residual/result.baseline.runoffM3*100):'0'}%)</span></div></div></div><div className="plan-reason-row"><div><h4>Alasan pilihan Anda</h4><p className="plan-user-note">{project.selectedPlan?.decisionNote?.trim()||'Belum dicatat'}</p></div><button className="btn-secondary" onClick={editNote}>{project.selectedPlan?.decisionNote?.trim()?'Ubah alasan':'Catat alasan pilihan'}</button></div></section>
      <PlanScenarioRows project={project} plan={plan} scenario={scenario} onScenario={onScenario}/>
    </div>
    <section className="plan-action-strip" aria-label="Sebelum pemasangan dan tindakan rencana">
      <div className="plan-action-intro"><h3>Sebelum pemasangan</h3><p>{resourceBlocked?'Rencana ini melampaui batas biaya atau lahan. Ubah batas atau pilih paket lain sebelum mengunduh.':checks[0]?.message || 'Data utama rencana sudah lengkap untuk tahap pra-perencanaan.'}</p></div>
      {checks.length>0&&<button className="plan-action-item" onClick={()=>onCheck(checks[0]!)}><ClipboardCheck size={24} aria-hidden="true"/><span><strong>Periksa sebelum pemasangan</strong><small>{checks[0]!.label}</small></span></button>}
      <button className="plan-action-item" onClick={onCompare}><ArrowRight size={24} aria-hidden="true"/><span><strong>Ganti pilihan</strong><small>Bandingkan alternatif kembali</small></span></button>
      <button className="plan-action-item" disabled={stale||!result.feasible||resourceBlocked} onClick={onExport}><Download size={24} aria-hidden="true"/><span><strong>Unduh / ekspor</strong><small>{resourceBlocked?'Perbaiki batas atau paket':'Simpan rencana ini'}</small></span></button>
      <button className="primary plan-action-primary" disabled={stale||!result.feasible||resourceBlocked} onClick={onExport}><Download size={18}/>Ringkasan pra-perencanaan</button>
    </section>
    {active && values && <ContextDialog title={active.name} onClose={()=>setSelected(null)}>
      <dl className="plan-component-values"><dt>Target air</dt><dd>{active.targets.map(id=>project.zones.find(z=>z.id===id)?.name ?? "Zona terhapus").join(", ") || "Belum dinyatakan"}</dd>
      <dt>Kapasitas kejadian</dt><dd>{values.capacity.text ? `${values.capacity.text} m³/kejadian` : "Belum diketahui"}</dd><dt>Biaya</dt><dd>{values.cost.text ? money(Number(values.cost.text)) : "Belum diketahui"}</dd><dt>Lahan terpakai</dt><dd>{values.area.text ? `${values.area.text} m²` : "Belum diketahui"}</dd></dl>
      <button className="text-button" onClick={()=>{setSelected(null);onExplain();}}>Lihat alasan, sumber & syarat penerapan<ArrowRight size={16}/></button>
    </ContextDialog>}
  </div>;
}
