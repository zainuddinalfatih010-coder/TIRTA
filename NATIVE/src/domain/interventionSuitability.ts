import type { ComponentVariant } from "./intervention-contract";
import type { ProjectV2 } from './projectV2';
import { referencedSoil } from './treatmentDesign';
import { sourceConnects } from './sourceRouting';

/** Read-only compatibility projection. Original legacy declarations remain in the payload.
 * New explicit evidence is edited through the existing soil/path/media questions. */
export function legacySiteFindings(c:ComponentVariant) {
  const a=c.siteAssessment;
  if(!a)return [];
  const findings:{rule:'CONNECTION'|'SOIL'|'MEDIA'|'CONVERSION';field:string;message:string}[]=[];
  const add=(rule:typeof findings[number]['rule'],field:string,message:string)=>findings.push({rule,field,message:`${message} Dasar lama: ${a.source}`});
  if(c.family!=='permeable'&&a.connection==='no')add('CONNECTION','via','Penyaluran dinyatakan tidak memungkinkan; periksa atau nyatakan jalur yang benar.');
  if(c.family!=='storage'&&a.infiltration==='no')add('SOIL','soil','Lokasi dinyatakan tidak cocok untuk infiltrasi; tinjau bukti tanah.');
  if(c.family==='rain-garden'&&a.plantingSpace==='no')add('MEDIA','media','Ruang penanaman lama dinyatakan tidak tersedia; tinjau rencana media dan tanaman.');
  if(c.family==='permeable'&&a.surfaceChange==='no')add('CONVERSION','system','Penggantian permukaan lama dinyatakan tidak diizinkan; tinjau sistem dan spesifikasinya.');
  return findings;
}

/** A deliberate correction through existing current fields supersedes a legacy declaration.
 * Importing or merely saving unchanged fields never clears a known negative.
 * Retain the prior declaration and its source in the original compatibility payload. */
export function reviewLegacySite(before:ProjectV2,after:ProjectV2,id:string):ProjectV2 {
  const c=after.components.find(item=>item.id===id),a=c?.siteAssessment;
  if(!c||!a)return after;
  const old=before.science?.interventions[id],e=after.science?.interventions[id];
  const changed=(left:unknown,right:unknown)=>JSON.stringify(left)!==JSON.stringify(right);
  const soil=e?referencedSoil(after,c,e):null;
  const corrections:('connection'|'infiltration'|'plantingSpace'|'surfaceChange')[]=[];
  if(a.connection==='no'&&changed(before.science?.connections.filter(l=>l.candidateId===id),after.science?.connections.filter(l=>l.candidateId===id))&&c.targets.length&&c.targets.every(z=>sourceConnects(after,z,id)))corrections.push('connection');
  if(a.infiltration==='no'&&changed([old?.soilInfiltration,old?.soilReference],[e?.soilInfiltration,e?.soilReference])&&soil&&!soil.stale&&soil.number?.value!=null&&soil.number.value>0&&soil.number.origin!=='unknown'&&soil.number.source.trim())corrections.push('infiltration');
  if(a.plantingSpace==='no'&&changed([old?.media,old?.vegetation],[e?.media,e?.vegetation])&&e?.media.trim()&&e.vegetation.trim())corrections.push('plantingSpace');
  if(a.surfaceChange==='no'&&changed([old?.system,old?.specification],[e?.system,e?.specification])&&e?.system.trim()&&e.specification.trim())corrections.push('surfaceChange');
  if(!corrections.length)return after;
  const source=`${a.source}\nTinjauan pengguna melalui isian saat ini menggantikan deklarasi lama: ${corrections.map(key=>`${key}=no`).join(', ')}.`;
  const next=structuredClone(after),updated=next.components.find(item=>item.id===id)!.siteAssessment!;
  for(const key of corrections)updated[key]='yes';
  // Do not truncate a full legacy evidence note. The explicit correction is
  // retained in the current soil/path/media evidence; the old source stays verbatim.
  updated.source=source.length<=2000?source:a.source;
  return next;
}

// These are declared site facts, never inferred from a source-zone polygon or class.
export function interventionBlockers(c: ComponentVariant): string[] {
  const a = c.siteAssessment;
  if (!a) return [];
  const reasons: string[] = [];
  if (c.family !== "permeable" && a.connection === "no") reasons.push("penyaluran air ke intervensi dinyatakan tidak memungkinkan");
  if (c.family !== "storage" && a.infiltration === "no") reasons.push("lokasi dinyatakan tidak cocok untuk infiltrasi yang dimodelkan");
  if (c.family === "rain-garden" && a.plantingSpace === "no") reasons.push("ruang penanaman dinyatakan tidak tersedia");
  if (c.family === "permeable" && a.surfaceChange === "no") reasons.push("penggantian permukaan dinyatakan tidak diperbolehkan");
  return reasons.map(r => `${c.name}: ${r}. Dasar pengguna: ${a.source}`);
}

export function interventionUnknowns(c: ComponentVariant): string[] {
  const a = c.siteAssessment;
  const checks: string[] = [];
  if (c.family !== "permeable" && (!a || a.connection === "unknown")) checks.push(`${c.name}: penyaluran air belum diperiksa di lokasi pemasangan`);
  if (c.family !== "storage" && (!a || a.infiltration === "unknown")) checks.push(`${c.name}: kesesuaian tanah / lapisan bawah untuk infiltrasi belum diperiksa`);
  if (c.family === "rain-garden" && (!a || a.plantingSpace === "unknown")) checks.push(`${c.name}: ruang vegetasi belum diperiksa`);
  if (c.family === "permeable" && (!a || a.surfaceChange === "unknown")) checks.push(`${c.name}: izin / kemungkinan mengganti permukaan belum diperiksa`);
  if (c.family === "storage") {
    if (!c.waterUse || c.waterUse === "unknown") checks.push(`${c.name}: tujuan air tampungan belum dipilih`);
    if (!c.drawdown || c.drawdown === "unknown") checks.push(`${c.name}: cara menyiapkan ruang untuk hujan berikutnya belum direncanakan`);
    if (c.drawdown === "unavailable") checks.push(`${c.name}: belum ada cara pengosongan; ruang untuk hujan berikutnya tidak dapat dijamin`);
  }
  if (c.family === "rain-garden" && (!c.plantingPlan || c.plantingPlan === "unknown")) checks.push(`${c.name}: pemilihan tanaman / media belum direncanakan`);
  return checks;
}
