import type { ProjectV2 } from '../domain/projectV2';
import type { Plan, PlanBalance } from '../domain/planningEngine';
import type { Baseline } from '../domain/baseline';
export const escapeXml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
const fmt = (v: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(v);
const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;
const label = (x: number, y: number, value: string, size = 12, color = '#123f59') => `<text x="${x}" y="${y}" font-family="Roboto" font-size="${size}" fill="${color}">${escapeXml(value)}</text>`;
const colors = { roof:'#ca906c', paved:'#a5b4bb', soil:'#ddc391', vegetation:'#a3bf78', porous:'#80afaa' };
/** Decision provenance, not a hydraulic connection or a causal performance claim. */
export function reasoningFigure(steps: {title:string; value:string}[]): string {
  return svg(550,steps.length*48,steps.map((step,i)=>{
    const y=i*48;
    return (i>0 ? `<path d="M18 ${y-12} V${y+3} M13 ${y-2} L18 ${y+3} L23 ${y-2}" fill="none" stroke="#54b9af" stroke-width="1.5"/>` : '') +
      `<circle cx="18" cy="${y+20}" r="14" fill="#164e74"/>`+label(14,y+24,String(i+1),11,'#fff')+
      label(45,y+17,step.title,12)+label(45,y+34,step.value,11,'#496b7c');
  }).join(''));
}
export function parcelFigure(p: ProjectV2, plan?: Plan): string {
  const points = [...(p.parcel?.polygon ?? []), ...p.zones.flatMap(z => z.polygon)];
  if (!points.length) return svg(500, 140, label(12, 60, 'Batas persil belum tersedia.'));
  const minX = Math.min(...points.map(v => v.x)), maxX = Math.max(...points.map(v => v.x));
  const minY = Math.min(...points.map(v => v.y)), maxY = Math.max(...points.map(v => v.y));
  const scale = Math.min(450 / Math.max(maxX - minX, 1), 180 / Math.max(maxY - minY, 1));
  const x = (v: number) => 25 + (v - minX) * scale, y = (v: number) => 15 + (v - minY) * scale;
  const polygon = (points: {x:number;y:number}[], fill: string) => `<polygon points="${points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ')}" fill="${fill}" stroke="#496875" stroke-width="1"/>`;
  const components = plan?.components.filter(c => c.enabled) ?? [];
  const centers = new Map(p.zones.map(z => [z.id, { x: z.polygon.reduce((sum, v) => sum + x(v.x), 0) / z.polygon.length, y: z.polygon.reduce((sum, v) => sum + y(v.y), 0) / z.polygon.length }]));
  const sources = new Set(components.flatMap(c => c.targets));
  const overlays = p.zones.filter(z => sources.has(z.id)).map(z => `<polygon points="${z.polygon.map(v => `${x(v.x)},${y(v.y)}`).join(' ')}" fill="none" stroke="#087c91" stroke-width="3"/>`).join('');
  const markerSites = new Map<string, number>();
  const markers = components.map((c, i) => {
    const installation = c.treatment?.installationZoneId;
    const center = installation ? centers.get(installation) : null;
    const position = c.placement ? { x: x(c.placement.point.x), y: y(c.placement.point.y) } : center;
    if (!position) return '';
    // Offset labels at a shared schematic location; spacing is never a water route.
    const key = `${position.x},${position.y}`, offset = markerSites.get(key) ?? 0; markerSites.set(key, offset + 1);
    const cx = Math.max(24, Math.min(476, position.x + (offset % 4) * 29)), cy = Math.max(14, Math.min(196, position.y + 20 + Math.floor(offset / 4) * 24));
    return `<rect x="${cx-13}" y="${cy-10}" width="26" height="20" rx="5" fill="#ffffff" stroke="#087c91" stroke-width="2"/>${label(cx-9, cy+4, `I${i+1}`, 10)}`;
  }).join('');
  return svg(500, 210, (p.parcel ? polygon(p.parcel.polygon, '#edf7fa') : '') + p.zones.map((z, i) => {
    const cx = z.polygon.reduce((sum, v) => sum + x(v.x), 0) / z.polygon.length;
    const cy = z.polygon.reduce((sum, v) => sum + y(v.y), 0) / z.polygon.length;
    return polygon(z.polygon, z.surface ? colors[z.surface] : '#e1e8eb') + (p.zones.length <= 20 ? `<circle cx="${cx}" cy="${cy}" r="10" fill="#123f59"/>${label(cx-4, cy+4, String(i+1), 11, '#ffffff')}` : '');
  }).join('') + overlays + markers);
}
export function balanceFigure(b: PlanBalance): string {
  const rows = [ { label:'Ditampung', value:b.stored, color:'#4da8e3' }, ...(b.reused > 0 ? [{label:'Digunakan kembali',value:b.reused,color:'#397bac'}] : []), {label:'Diinfiltrasikan',value:b.infiltrated,color:'#54b9af'}, {label:'Sisa limpasan',value:b.residual,color:'#809eb7'} ];
  const height = rows.length * 57 + 12;
  let start = height / 2 - 40;
  const paths = rows.map((r, i) => {
    const thickness = b.baseline > 0 ? r.value / b.baseline * 80 : 0;
    const dest = 22 + i * 57;
    const sy = start; start += thickness;
    const ribbon = thickness > 0 ? `<path d="M105 ${sy} C220 ${sy},245 ${dest-thickness/2},345 ${dest-thickness/2} L345 ${dest+thickness/2} C245 ${dest+thickness/2},220 ${sy+thickness},105 ${sy+thickness} Z" fill="${r.color}"/>` : '';
    return ribbon + `<line x1="345" y1="${dest}" x2="365" y2="${dest}" stroke="${r.color}" stroke-width="1.5"/>` + label(376,dest-3,r.label,11) + label(376,dest+16,`${fmt(r.value)} m³${b.baseline > 0 ? ` · ${fmt(r.value/b.baseline*100)}%` : ''}`,14);
  }).join('');
  return svg(550,height,paths+`<rect x="0" y="${height/2-40}" width="105" height="80" rx="7" fill="#164e74"/>`+label(12,height/2-13,'Limpasan awal',11,'#ffffff')+label(12,height/2+9,`${fmt(b.baseline)} m³`,18,'#ffffff')+label(12,height/2+28,b.baseline > 0 ? '100%' : 'Baseline nol',10,'#ffffff'));
}
export function contributionFigure(p: ProjectV2, b: Baseline): string {
  const rows = [...b.zones].sort((a,c)=>c.runoffM3-a.runoffM3 || a.id.localeCompare(c.id)).slice(0,6);
  const max = Math.max(...rows.map(r=>r.runoffM3),1e-12);
  return svg(500,rows.length*26+8,rows.map((r,i)=>{
    const zone = p.zones.find(z=>z.id===r.id)!;
    const index = p.zones.findIndex(z=>z.id===r.id)+1;
    return label(0,18+i*26,`Zona ${index}`,11)+`<rect x="60" y="${6+i*26}" width="335" height="14" rx="2" fill="#e6f1f5"/><rect x="60" y="${6+i*26}" width="${r.runoffM3/max*335}" height="14" rx="2" fill="${zone.surface ? colors[zone.surface] : '#aab9c0'}"/>`+label(407,18+i*26,`${fmt(r.runoffM3)} m³`,11);
  }).join(''));
}
/** Used resources divided by declared limits; a zero limit has no percentage. */
export function resourceFigure(b:PlanBalance):string {
  const rows=[{name:'Biaya',used:b.cost,limit:b.budget,values:`Rp${fmt(b.cost)} / Rp${fmt(b.budget)}`},{name:'Lahan',used:b.area,limit:b.usableArea,values:`${fmt(b.area)} / ${fmt(b.usableArea)} m²`}];
  return svg(550,94,rows.map((r,i)=>{
    const x=i*280, share=r.limit>0 ? r.used/r.limit : null;
    return label(x,15,r.name,11)+label(x,37,r.values,14)+`<rect x="${x}" y="48" width="250" height="8" rx="4" fill="#e2edf2"/>`+(share!==null?`<rect x="${x}" y="48" width="${Math.max(0,Math.min(1,share))*250}" height="8" rx="4" fill="#078aa4"/>`:'')+label(x,76,share!==null?`${fmt(share*100)}% dari batas`:'Batas nol · persentase tidak dihitung',10,'#496b7c');
  }).join(''));
}
