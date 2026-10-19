import { useId, useState } from "react";
import { Cylinder, Droplets, ArrowDownToDot, Recycle } from "lucide-react";
import { CalculationSource } from "./CalculationSource";
import { fmt, type Evaluation } from "./productionBridge";

export function PlanWaterFlow({ result }: { result: Evaluation }) {
  const [reading, setReading] = useState<string | null>(null);
  const gradientId=useId().replace(/:/g, "");
  const total = result.baseline.runoffM3;
  const parts = [
    { id:"stored", label:"Ditampung", value:result.retained, color:"#73bef0", Icon:Cylinder, note:"Air yang masih tersimpan setelah kejadian hujan. Tampungan bukan pemanfaatan; rencana penggunaan dan pengosongan perlu ditinjau." },
    { id:"infiltrated", label:"Diinfiltrasikan", value:result.infiltrated, color:"#7acabd", Icon:ArrowDownToDot, note:"Volume yang meresap sesuai kapasitas untuk hujan ini. Kemampuan tanah setempat tetap perlu diperiksa." },
    ...(result.reused > 0 ? [{ id:"reused", label:"Dimanfaatkan", value:result.reused, color:"#b4a3d5", Icon:Recycle, note:"Air yang digunakan selama hujan sesuai kebutuhan yang Anda isi, terpisah dari air yang masih tersimpan." }] : []),
    { id:"residual", label:"Sisa limpasan", value:result.residual, color:"#a0b5c6", Icon:Droplets, note:"Volume yang belum tertangani pada neraca kejadian ini. Bukan kedalaman genangan atau prediksi banjir." },
  ];
  let consumed=0;
  const paths=parts.map((part,index) => {
    const share=total > 0 ? part.value/total : 0;
    const start=54+consumed*90;
    const end=4+consumed*132+50/(parts.length-1)*index;
    consumed+=share;
    const thickness=share*132;
    const capHeight=Math.max(parts.length>3 ? 14 : 22,thickness);
    const capY=Math.max(4,Math.min(186-capHeight,end+(thickness-capHeight)/2));
    const capColor=part.id==="stored" ? "#2197eb" : part.id==="infiltrated" ? "#19aaa8" : part.id==="reused" ? "#8871b8" : "#6287ab";
    return { ...part, capColor,capY,capHeight,endCenter:end+thickness/2,labelCenter:205/parts.length*(index+.5), path:`M179 ${start} C355 ${start} 358 ${end} 575 ${end} L575 ${end+thickness} C358 ${end+thickness} 355 ${start+share*90} 179 ${start+share*90} Z` };
  });
  const selected=parts.find(p=>p.id===reading);
  return <section className="water-partition plan-water-flow" aria-label="Pembagian volume limpasan">
    <header><h3>Bagaimana rencana ini menangani limpasan?</h3></header>
    <div className="volume-chart plan-flow-chart">
      <div className="plan-flow-stage">
        <div className="plan-flow-art">
        <div className="plan-flow-origin"><span>Limpasan awal</span><strong>{fmt(total)} <small>m³</small></strong>{total > 0 && <span>(100%)</span>}</div>
        <svg viewBox="0 0 650 205" preserveAspectRatio="none" role="img" aria-label="Aliran volume dari limpasan awal ke tampungan, infiltrasi, pemanfaatan bila ada, dan sisa limpasan">
          <defs>{paths.map(part=><linearGradient key={part.id} id={`${gradientId}-${part.id}`}><stop offset="0" stopColor={part.id==="infiltrated" ? "#75d2ce" : part.color}/><stop offset="1" stopColor={part.id==="infiltrated" ? "#79d4d0" : part.color}/></linearGradient>)}</defs>
          {paths.map(part => part.value > 0 && <g key={part.id}><path data-volume={part.value} data-category={part.id} d={part.path} fill={`url(#${gradientId}-${part.id})`} /><rect data-terminal={part.id} x="563" y={part.capY} width="24" height={part.capHeight} rx="5" fill={part.capColor}/><path className="plan-flow-leader" d={`M587 ${part.endCenter} L618 ${part.labelCenter} H650`} fill="none" stroke={part.color} strokeWidth=".8"/></g>)}
        </svg>
      </div>
        <div className="volume-legend plan-flow-labels">{parts.map(({ id,label,value,color,Icon }) => <button key={id} type="button" aria-pressed={reading===id} onClick={()=>setReading(reading===id ? null : id)}>
          <Icon size={30} aria-hidden="true" style={{ color }} /><span><span>{label}</span><strong>{fmt(value)} <small>m³</small></strong><small>{total > 0 ? `${fmt(value/total*100)}%` : "Persentase tidak berlaku pada 0 m³"}</small></span>
        </button>)}</div>
      </div>
      {selected && <p className="chart-reading" role="status"><strong>{selected.label}: {fmt(selected.value)} m³.</strong> {selected.note}</p>}
    </div>
    <p className="equation-note">{fmt(total)} = {parts.map(p=>fmt(p.value)).join(" + ")} m³ · pembulatan dua desimal. Air yang sama tidak dihitung dua kali.</p>
    <CalculationSource method="ledger" />
  </section>;
}
