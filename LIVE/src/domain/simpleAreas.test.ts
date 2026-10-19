import { describe, it, expect } from 'vitest';
import { createProjectV2, projectV2Schema } from './projectV2';
import { addSimpleArea, editSimpleArea } from './simpleAreas';
import { reshape, deleteZone } from './authoring';
import { polygonArea } from './geometry';
import { dimensionParcel } from '../direction/parcelTransactions';
import { demoProject, setActiveComponents } from '../direction/productionBridge';
import { projectBackup } from '../persistence/portable';
let sequence = 0;
const id = () => `simple-${++sequence}`;
const fresh = () => createProjectV2('field', 'Halaman', '2026-10-08T00:00:00.000Z');
describe('declared area in the canonical project', () => {
  it('keeps declared area independent of diagram, coefficient and observations unknown', () => {
    const {project:p,zoneId} = addSimpleArea(fresh(), {name:'Halaman',surface:'soil',area:30,parcelArea:100}, id);
    const z=p.zones.find(z=>z.id===zoneId)!;
    expect(p.parameters.find(v=>v.id===z.area.id)?.value).toBe(30);
    expect(p.parameters.find(v=>v.id===z.coefficient.id)?.value).toBeNull();
    expect(z.classificationRecordId).toBeTruthy();
    expect(p.drawingScale).toBeUndefined();
    expect(z.geometryContext).toBe('schematic-area');
    expect(polygonArea(z.polygon)).not.toBe(30);
    expect(projectV2Schema.parse(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const next=reshape(p,zoneId,[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]);
    expect(next.parameters.find(v=>v.id===z.area.id)?.value).toBe(30);
  });
  it('uses only declared length and width for dimensions and preserves source basis', () => {
    const {project:p}=addSimpleArea(fresh(),{name:'Atap',surface:'roof',length:5,width:6,parcelArea:100},id);
    expect(p.zones[0]!.areaMethod.kind).toBe('measured-rectangle');
    expect(p.parameters.find(v=>v.id===p.zones[0]!.area.id)?.value).toBe(30);
    expect(p.parameters.find(v=>v.id===p.zones[0]!.area.id)?.evidence).toBe('SOURCE_DERIVED');
  });
  it('rejects impossible input atomically rather than defaulting',()=>{
    for(const area of [0,-1,Infinity,NaN,101]) expect(()=>addSimpleArea(fresh(),{name:'Area',surface:'soil',area,parcelArea:100},id)).toThrow();
    expect(()=>addSimpleArea(fresh(),{name:'Area',surface:'soil',area:30},id)).toThrow(/persil/i);
  });
  it('adds independently editable areas without moving prior shapes; deletion frees numeric coverage',()=>{
    const a=addSimpleArea(fresh(),{name:'A',surface:'roof',area:60,parcelArea:100},id);
    const b=addSimpleArea(a.project,{name:'B',surface:'soil',area:40},id);
    expect(b.project.zones[0]!.polygon).toEqual(a.project.zones[0]!.polygon);
    expect(()=>addSimpleArea(b.project,{name:'C',surface:'soil',area:1},id)).toThrow(/luas/i);
    expect(addSimpleArea(deleteZone(b.project,b.zoneId),{name:'C',surface:'soil',area:40},id).project.zones).toHaveLength(2);
  });
  it('can calibrate the parcel later without replacing entered areas with diagram measurements',()=>{
    const {project:p}=addSimpleArea(fresh(),{name:'Area',surface:'soil',area:100,parcelArea:100},id);
    const next=dimensionParcel(p,'10','10');
    expect(next.drawingScale?.initialLength).toBe(10);
    expect(next.parameters.find(v=>v.id===next.zones[0]!.area.id)?.value).toBe(100);
    expect(next.zones[0]!.geometryContext).toBe('schematic-area');
    expect(projectV2Schema.safeParse(next).success).toBe(true);
  });
  it('edits a declared area without silently changing neighbouring shapes or exceeding the parcel',()=>{
    const {project:p,zoneId}=addSimpleArea(fresh(),{name:'Area',surface:'soil',area:60,parcelArea:100},id);
    const next=editSimpleArea(p,zoneId,{name:'Area baru',surface:'soil',area:40},id);
    expect(next.parameters.find(v=>v.id===next.zones[0]!.area.id)?.value).toBe(40);
    expect(next.zones[0]!.polygon).toEqual(p.zones[0]!.polygon);
    expect(()=>editSimpleArea(p,zoneId,{name:'A',surface:'soil',area:101},id)).toThrow(/luas/i);
  });
  it('coexists with a calibrated advanced drawing and survives a portable restore without deriving area from the sketch',()=>{
    const original=deleteZone(setActiveComponents(demoProject(),[]),'z2');
    const result=addSimpleArea(original,{name:'Area pengamatan',surface:'soil',area:30},id);
    expect(result.project.zones.slice(0,4)).toEqual(original.zones);
    const z=result.project.zones.find(z=>z.id===result.zoneId)!;
    expect(polygonArea(z.polygon)).not.toBe(30);
    const restored=projectV2Schema.parse(JSON.parse(projectBackup(result.project)).project);
    const changed=reshape(restored,z.id,[{x:14,y:3},{x:16,y:3},{x:16,y:5},{x:14,y:5}]);
    expect(changed.parameters.find(v=>v.id===z.area.id)?.value).toBe(30);
    expect(changed.parameters.find(v=>v.id===z.coefficient.id)?.value).toBeNull();
    expect(changed.zones.filter(v=>v.id!==z.id)).toEqual(original.zones);
  });
});
