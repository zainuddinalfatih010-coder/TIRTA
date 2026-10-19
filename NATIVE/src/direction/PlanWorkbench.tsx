import { useId, useState, type ReactNode } from "react";
import { Droplets, FileText, Database, ShieldCheck } from "lucide-react";

const views=[{id:"summary",label:"Ringkasan"},{id:"evidence",label:"Penjelasan lengkap"},{id:"recommendation",label:"Rekomendasi"}] as const;
const topics=[{id:"water",label:"Dampak air",Icon:Droplets},{id:"package",label:"Isi & alasan paket",Icon:FileText},{id:"data",label:"Data & sumber",Icon:Database},{id:"checks",label:"Verifikasi",Icon:ShieldCheck}] as const;
export function PlanWorkbench({ children,field,screening,summary,water,targets,recommendation,hasResult }: {children:ReactNode;field:ReactNode;screening:ReactNode;summary?: (explain:()=>void)=>ReactNode;water?:ReactNode;targets?:ReactNode;recommendation?:ReactNode;hasResult:boolean}) {
  const [view,setView]=useState<(typeof views)[number]["id"]>("summary");
  const [topic,setTopic]=useState<(typeof topics)[number]["id"]>("water");
  const active=!hasResult && view==="summary" ? "evidence" : view;
  const actualTopic=hasResult ? topic : "package";
  const id=useId();
  const explain=()=>{setView("evidence");setTopic("package");requestAnimationFrame(()=>document.getElementById(`${id}-evidence`)?.focus());};
  return <section className="plan-workbench" aria-label="Rencana pilihan Anda">
    <div className="plan-view-tabs" role="tablist" aria-label="Bagian rencana">{views.map((item,index)=><button key={item.id} id={`${id}-${item.id}`} role="tab" aria-selected={active===item.id} aria-controls={`${id}-panel`} tabIndex={active===item.id ? 0 : -1} disabled={item.id==="summary" && !hasResult} onClick={()=>setView(item.id)} onKeyDown={e=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();
      let target=e.key==="Home" ? 0 : e.key==="End" ? views.length-1 : (index+(e.key==="ArrowRight" ? 1 : views.length-1))%views.length;
      if(!hasResult && target===0)target=e.key==="ArrowLeft" ? views.length-1 : 1;
      setView(views[target]!.id);document.getElementById(`${id}-${views[target]!.id}`)?.focus();
    }}>{item.label}</button>)}</div>
    <div className="plan-explanation-topics" role="group" aria-label="Topik penjelasan rencana" hidden={active!=="evidence"}>{topics.map(({id:topicId,label,Icon})=><button key={topicId} aria-pressed={actualTopic===topicId} disabled={!hasResult && topicId!=="package"} onClick={()=>setTopic(topicId)}><Icon size={20} aria-hidden="true"/>{label}</button>)}</div>
    {/* Editors remain mounted so switching views/topics never discards drafts. */}
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`} className="plan-detail-body" data-view={active} data-topic={actualTopic}>
      {summary?.(explain)}
      {water && <div className="plan-explanation-flow">{water}</div>}
      {targets && <div className="plan-package-visual">{targets}</div>}
      {children}
      <div className="plan-feasibility-review">{screening}</div>
      <div className="plan-field-work">{field}</div>
      {recommendation && <div className="plan-recommendation-work">{recommendation}</div>}
    </div>
  </section>;
}
