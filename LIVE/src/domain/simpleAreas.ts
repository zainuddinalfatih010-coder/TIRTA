import type { ProjectV2 } from './projectV2';
import type { Surface } from './model';
import { addShape, updateShapeData, checked } from './authoring';
import { containsPolygon, polygonsOverlap } from './geometry';
import { MAX_PARCEL_AREA_M2 } from './parcelPolicy';
export type SimpleAreaInput = { name: string; surface: Surface; area?: number; length?: number; width?: number; parcelArea?: number };
export function editSimpleArea(p:ProjectV2,zoneId:string,input:SimpleAreaInput,newId:()=>string):ProjectV2 {
  const z=p.zones.find(z=>z.id===zoneId);
  if(!z||z.geometryContext!=='schematic-area')throw new Error('Area ini menggunakan bentuk kanvas; ubah ukurannya melalui kanvas.');
  const dimensions=input.length!==undefined||input.width!==undefined,area=dimensions?(input.length??NaN)*(input.width??NaN):input.area;
  if(!input.name.trim()||area==null||!Number.isFinite(area)||area<=0||(dimensions&&(!(input.length!>0)||!(input.width!>0))))throw new Error('Isi nama dan ukuran positif yang diketahui.');
  const parcelArea=p.parameters.find(v=>v.id===p.parcel?.area.id)?.value;
  const otherArea=p.zones.filter(other=>other.id!==zoneId).reduce((sum,other)=>sum+(p.parameters.find(v=>v.id===other.area.id)?.value??0),0);
  if(parcelArea==null||otherArea+area>parcelArea+1e-9)throw new Error('Jumlah luas area melebihi luas persil. Koreksi ukuran; data belum diterapkan.');
  const coefficient=p.parameters.find(v=>v.id===z.coefficient.id)!;
  return updateShapeData(p,zoneId,{name:input.name.trim(),surface:input.surface,area:declared(area),coefficient,method:dimensions?'measured-rectangle':'direct',length:dimensions?declared(input.length!):unknown,width:dimensions?declared(input.width!):unknown},newId);
}
const unknown = {value:null,evidence:'UNKNOWN' as const,source:'',note:''};
const declared = (value:number) => ({value,evidence:'USER_INPUT' as const,source:'Ukuran dinyatakan pengguna melalui Tambah area sederhana.',note:''});
const rectangle = (x:number,y:number,w:number,h:number) => [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}].map(p=>({x:Math.round(p.x*1000)/1000,y:Math.round(p.y*1000)/1000}));
/** Places a diagram, not a surveyed footprint. Existing zones are never moved. */
function diagramSlot(p:ProjectV2, area:number, parcelArea:number) {
  const boundary=p.parcel!.polygon;
  const xs=boundary.map(v=>v.x),ys=boundary.map(v=>v.y);
  const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  const valid=(points:ReturnType<typeof rectangle>)=>containsPolygon(boundary,points)&&p.zones.every(z=>!polygonsOverlap(z.polygon,points));
  if(!p.drawingScale && p.zones.every(z=>z.geometryContext==='schematic-area')) {
    const height=Math.round(h*area/parcelArea*1000)/1000;
    for(const top of [y,...p.zones.flatMap(z=>z.polygon.map(v=>v.y))].sort((a,b)=>a-b)) {
      const points=rectangle(x,top,w,height);
      if(valid(points))return points;
    }
  }
  // Mixed/irregular drawings: search only for a free diagram position, never infer physical area.
  for(const divisions of [2,4,8,16,32])for(let row=0;row<divisions;row++)for(let column=0;column<divisions;column++) {
    const points=rectangle(x+w*column/divisions,y+h*row/divisions,w/divisions,h/divisions);
    if(valid(points))return points;
  }
  throw new Error('Tidak ada ruang sketsa kosong. Atur bentuk zona di kanvas atau hapus bagian yang tidak digunakan; angka luas belum ditambahkan.');
}
export function addSimpleArea(p: ProjectV2, input: SimpleAreaInput, newId: () => string): { project: ProjectV2; zoneId: string } {
  const dimensions=input.length!==undefined||input.width!==undefined;
  const area=dimensions ? (input.length??NaN)*(input.width??NaN) : input.area;
  if(!input.name.trim())throw new Error('Isi nama area.');
  if(area==null||!Number.isFinite(area)||area<=0||(dimensions&&(!(input.length!>0)||!(input.width!>0))))throw new Error('Isi luas positif, atau panjang dan lebar yang diketahui.');
  let next=structuredClone(p);
  const parcelArea=p.parcel ? p.parameters.find(v=>v.id===p.parcel!.area.id)?.value : input.parcelArea;
  if(parcelArea==null||!Number.isFinite(parcelArea)||parcelArea<=0||parcelArea>MAX_PARCEL_AREA_M2)throw new Error('Isi luas persil yang diketahui, maksimum 200 m².');
  const previousArea=p.zones.reduce((sum,z)=>sum+(p.parameters.find(v=>v.id===z.area.id)?.value??0),0);
  if(previousArea+area>parcelArea+1e-9)throw new Error(`Jumlah luas area melebihi luas persil ${parcelArea} m². Koreksi ukuran; data belum diterapkan.`);
  if(!next.parcel) {
    const parcelId=newId();
    next=addShape(next,parcelId,rectangle(0,0,100,100),true);
    next=updateShapeData(next,parcelId,{name:'Persil',surface:null,area:declared(parcelArea),coefficient:unknown,method:'direct',length:unknown,width:unknown},newId);
  }
  const polygon=diagramSlot(next,area,parcelArea), zoneId=newId();
  next=addShape(next,zoneId,polygon);
  next.zones.find(z=>z.id===zoneId)!.geometryContext='schematic-area';
  next=updateShapeData(next,zoneId,{name:input.name.trim(),surface:input.surface,area:declared(area),coefficient:unknown,method:dimensions?'measured-rectangle':'direct',length:dimensions?declared(input.length!):unknown,width:dimensions?declared(input.width!):unknown},newId);
  return {project:checked(next),zoneId};
}
