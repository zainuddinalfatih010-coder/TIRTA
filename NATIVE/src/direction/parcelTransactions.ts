import type { ProjectV2 } from "../domain/projectV2";
import { projectV2Schema } from "../domain/projectV2";
import { addShape, reshape, reference } from "../domain/authoring";
import { deriveEditedAreas } from "../domain/scaledAreas";
import { numericInput } from "../domain/validation";
import type { Point } from "../domain/model";

export const rectanglePoints = (a: Point, b: Point): Point[] => [
  { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, { x: Math.max(a.x, b.x), y: Math.min(a.y, b.y) },
  { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }, { x: Math.min(a.x, b.x), y: Math.max(a.y, b.y) },
];
export function dimensionParcel(p: ProjectV2, length: string, width: string): ProjectV2 {
  const l = numericInput(length), w = numericInput(width);
  if (!l.ok || !w.ok || l.value === null || w.value === null || l.value <= 0 || w.value <= 0) throw new Error("Isi panjang dan lebar lebih dari nol, dalam meter.");
  if (l.value * w.value > 200) throw new Error("Maksimum luas persil 200 m². Dimensi tidak diubah otomatis.");
  const polygon = rectanglePoints({ x: 0, y: 0 }, { x: l.value, y: w.value });
  let next: ProjectV2;
  if(p.parcel && !p.drawingScale && p.zones.length && p.zones.every(z=>z.geometryContext==='schematic-area')) {
    // Explicit parcel calibration rescales layout only; entered zone areas stay authoritative.
    next=structuredClone(p);
    const xs=p.parcel.polygon.map(v=>v.x),ys=p.parcel.polygon.map(v=>v.y),x=Math.min(...xs),y=Math.min(...ys),dx=Math.max(...xs)-x,dy=Math.max(...ys)-y;
    next.parcel!.polygon=polygon;
    next.zones=next.zones.map(z=>({...z,revision:z.revision+1,polygon:z.polygon.map(v=>({x:Math.round((v.x-x)/dx*l.value!*1000)/1000,y:Math.round((v.y-y)/dy*w.value!*1000)/1000}))}));
    const move=(point:Point)=>({x:Math.round((point.x-x)/dx*l.value!*1000)/1000,y:Math.round((point.y-y)/dy*w.value!*1000)/1000});
    for(const component of next.components)if(component.placement){component.placement.point=move(component.placement.point);if(component.placement.footprint)component.placement.footprint=component.placement.footprint.map(move);}
  }else next=p.parcel ? reshape(p, p.parcel.id, polygon) : addShape(p, crypto.randomUUID(), polygon, true);
  return projectV2Schema.parse(deriveEditedAreas({ ...next, drawingScale: {
    metersPerUnit: 1, initialLength: l.value, initialWidth: w.value,
    source: `Dimensi awal ${l.value} × ${w.value} m dinyatakan pengguna; koordinat lokal, bukan survei atau GPS.`,
  } }));
}

/** Undo only the geometry transaction; keep subsequent coefficients, image decisions and rain. */
export function restoreParcelGeometry(current: ProjectV2, snapshot: ProjectV2): ProjectV2 {
  const p = structuredClone(current);
  const currentShapes = [...(current.parcel ? [current.parcel] : []), ...current.zones];
  const snapshotShapes = [...(snapshot.parcel ? [snapshot.parcel] : []), ...snapshot.zones];
  const changed = [...currentShapes.filter(s => !snapshotShapes.some(old => old.id === s.id)), ...snapshotShapes.filter(s => !currentShapes.some(live => live.id === s.id))];
  const changedRefs = new Set(changed.flatMap(s => [s.area.id, ...("coefficient" in s ? [s.coefficient.id] : []), ...(s.areaMethod.kind === "measured-rectangle" ? [s.areaMethod.length.id, s.areaMethod.width.id] : [])]));
  p.scenarios = p.scenarios.map(s => ({ ...s, overrides: [...s.overrides.filter(o => !changedRefs.has(o.baseParameterId)), ...(snapshot.scenarios.find(old => old.id === s.id)?.overrides.filter(o => changedRefs.has(o.baseParameterId)) ?? [])] }));
  p.parcel = structuredClone(snapshot.parcel);
  p.drawingScale = snapshot.drawingScale;
  p.zones = snapshot.zones.map(old => {
    const live = current.zones.find(z => z.id === old.id);
    return { ...structuredClone(live ?? old), polygon: structuredClone(old.polygon), area: { ...old.area }, areaMethod: structuredClone(old.areaMethod), revision: (live?.revision ?? old.revision) + 1 };
  });
  // Restore area sources; retain all historical references for deleted objects and frozen plans.
  for (const old of snapshot.parameters) {
    const isGeometry = old.id === snapshot.parcel?.area.id || snapshot.zones.some(z => z.area.id === old.id);
    const index = p.parameters.findIndex(v => v.id === old.id);
    if (index < 0) p.parameters.push(structuredClone(old));
    else if (isGeometry) p.parameters[index] = { ...old, revision: p.parameters[index]!.revision + 1 };
  }
  for (const z of p.zones) {
    const value = p.parameters.find(v => v.id === z.coefficient.id);
    if (value) z.coefficient = reference(value);
  }
  return projectV2Schema.parse(deriveEditedAreas(p));
}
