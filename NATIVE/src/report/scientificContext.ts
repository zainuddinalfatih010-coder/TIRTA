import type { ProjectV2 } from '../domain/projectV2';
import type { Plan } from '../domain/planningEngine';
import type { ScientificNumber } from '../domain/scientificContract';
const fmt = (v: number) => new Intl.NumberFormat('id-ID', {maximumFractionDigits:2}).format(v);
const words:Record<string,string> = { unknown:'Belum diketahui', flat:'Datar', sloped:'Miring', mixed:'Campuran', grass:'Rumput', shrub:'Semak', tree:'Pohon', sandy:'Berpasir', loamy:'Geluh', clayey:'Liat', loose:'Gembur', moderate:'Sedang', compacted:'Padat', suitable:'Sesuai', unsuitable:'Tidak sesuai', 'not-applicable':'Tidak berlaku', reviewed:'Ditinjau', failed:'Tidak memenuhi', observed:'Teramati', 'not-observed':'Tidak teramati', maintained:'Terawat', clogged:'Tersumbat', damaged:'Rusak', 'gutter-downpipe':'Talang / pipa turun', edge:'Tepi atap', drain:'Saluran' };
const w = (v: string | null | undefined) => v ? words[v] ?? v : 'Belum dicatat';

/** Context is never converted into an extra numeric capacity or coefficient. */
export function scientificContextRows(p: ProjectV2, plan: Plan, includeSources=true): string[][] {
  const n = (v: ScientificNumber | undefined) => v?.value == null ? 'Belum diketahui' : `${fmt(v.value)} ${v.unit} · ${v.origin}${includeSources ? ` · ${v.source}${v.method ? ` · metode ${v.method}` : ''}${v.date ? ` · ${v.date}` : ''}` : ''}`;
  const rows:string[][]=[];
  p.zones.forEach(z=>{
    const c=p.science?.surfaces[z.id];
    if(!c) { rows.push([z.name,'Kondisi permukaan belum dicatat','Belum diketahui']);return; }
    const values = z.surface==='roof' ? [`Bentuk: ${w(c.roof.form)}`,`Material: ${w(c.roof.material)}`,`Saluran: ${w(c.roof.outlet)}`,`Kemiringan: ${n(c.roof.pitch)}`]
      : z.surface==='paved' ? [`Material: ${w(c.paved.material)}`,`Kondisi: ${w(c.paved.condition)}`,`Retak: ${w(c.paved.cracks)}`]
        : z.surface==='soil' ? [`Tanah: ${w(c.soil.description)}`,`Kepadatan: ${w(c.soil.compaction)}`,`Uji infiltrasi: ${n(c.soil.infiltration)}`]
          : z.surface==='vegetation' ? [`Tutupan: ${w(c.vegetation)}`,`Tanah: ${w(c.soil.description)}`,`Uji infiltrasi: ${n(c.soil.infiltration)}`]
            : z.surface==='porous' ? [`Sistem: ${w(c.porous.system)}`,`Permukaan: ${w(c.porous.surfaceLayer)}`,`Lapisan bawah: ${w(c.porous.base)}`,`Tanah dasar: ${w(c.porous.subgrade)}`,`Pemasangan: ${w(c.porous.installationDate)}`,`Pemeliharaan: ${w(c.porous.maintenance)}`,`Penyumbatan: ${w(c.porous.clogging)}`] : ['Jenis permukaan belum diketahui'];
    rows.push([z.name,values.join('\n'),c.source || 'Dasar belum dicatat']);
  });
  plan.components.filter(c=>c.enabled).forEach(c=>{
    const e=plan.scientificEvidence?.[c.id] ?? p.science?.interventions[c.id];
    if(!e){rows.push([c.name,'Data kesesuaian belum tersedia','Belum diketahui']);return;}
    const values=[`Sistem: ${w(e.system)}`,`Spesifikasi: ${w(e.specification)}`,`Pemeliharaan: ${w(e.maintenance)}`,`Kondisi: ${w(e.condition)}`,`Verifikasi lapangan: ${e.fieldVerified === null ? 'Belum diketahui' : e.fieldVerified ? 'Dinyatakan sudah diperiksa' : 'Belum diperiksa'}${includeSources ? ` · ${w(e.verificationSource)}` : ''}`];
    if(c.family==='storage')values.push(`Kapasitas nominal: ${n(e.nominalTankCapacity)}; berbeda dari ruang tampung yang tersedia saat hujan.`);
    else values.push(`Infiltrasi tanah: ${n(e.soilInfiltration)}`,`Kedalaman air tanah: ${n(e.groundwaterDepth)}`,`Tinjauan air tanah: ${w(e.groundwaterAssessment)}${includeSources ? ` · ${w(e.groundwaterBasis)}` : ''}`,`Tanah dasar: ${w(e.subgrade)}${includeSources ? ` · ${w(e.subgradeBasis)}` : ''}`,`Tinjauan standar: ${w(e.localStandardReview)}${includeSources ? ` · ${w(e.localStandardBasis)}` : ''}`);
    if(c.family==='rain-garden')values.push(`Media: ${w(e.media)}`,`Vegetasi: ${w(e.vegetation)}`);
    const overflow=e.overflow;
    values.push(`Kelebihan air: ${overflow.kind==='unknown' ? 'Belum diketahui' : 'id' in overflow ? p.zones.find(z=>z.id===overflow.id)?.name ?? p.components.find(v=>v.id===overflow.id)?.name ?? overflow.id : overflow.note || w(overflow.kind)}`);
    values.push(...Object.entries(e.performance).map(([sid,v])=>`${p.scenarios.find(s=>s.id===sid)?.name ?? sid}: dasar kapasitas ${v.origin}; ${includeSources ? `${v.source || 'belum dicatat'}; ${v.method ? `metode ${v.method}; ` : ''}${v.date ? `${v.date}; ` : ''}` : ''}berlaku pada ${v.rainfallMm == null ? 'hujan belum diketahui' : `${fmt(v.rainfallMm)} mm`}, ${v.durationMinutes == null ? 'durasi belum diketahui' : `${fmt(v.durationMinutes)} menit`}.`));
    rows.push([c.name,values.join('\n'),e.verificationSource || 'Lihat sumber kapasitas dan syarat penerapan']);
  });
  return rows;
}
