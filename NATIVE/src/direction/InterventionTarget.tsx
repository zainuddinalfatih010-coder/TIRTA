import { useState } from "react";
import type { ProjectV2 } from "../domain/projectV2";
import { readInput } from "../domain/planningAuthoring";
import { fmt } from "./productionBridge";

export function InterventionTarget({ project, targets, porous, missing, compact = false }: { project: ProjectV2; targets: string[]; porous: boolean; missing: boolean; compact?: boolean }) {
  const [selected, setSelected] = useState(targets);
  const zone = project.zones.find(z => z.id === selected[0]);
  const area = zone ? readInput(project, zone.area).text : "";
  const unavailable = (surface: string | null) => porous && surface !== 'paved';
  return <fieldset className="target-zones" aria-describedby="target-guidance"><legend>{porous ? "Zona mana yang akan diganti?" : "Air dari zona mana?"}</legend>
    {compact ? <>
      <select aria-label={porous ? "Zona yang diganti" : "Sumber air"} value={selected.length > 1 ? "multiple" : selected[0] ?? ""} onChange={e => { if (e.target.value !== "multiple") setSelected(e.target.value ? [e.target.value] : []); }}><option value="">Pilih zona</option>{selected.length > 1 && <option value="multiple">{selected.length} zona dipilih</option>}{project.zones.map(z => <option key={z.id} value={z.id} disabled={unavailable(z.surface)}>{z.name}{unavailable(z.surface) ? " · bukan Beton/Aspal" : ""}</option>)}</select>
      {selected.map(id => <input key={id} type="hidden" name="target" value={id}/>)}
      {!porous && <details className="target-multiple"><summary>Pilih beberapa zona</summary><div>{project.zones.map(z => <label className="check-line" key={z.id}><input type="checkbox" checked={selected.includes(z.id)} onChange={e => setSelected(e.target.checked ? [...selected, z.id] : selected.filter(id => id !== z.id))}/>{z.name}</label>)}</div></details>}
    </> : project.zones.map(z => <label className="check-line" key={z.id}><input type={porous ? "radio" : "checkbox"} name="target" value={z.id} checked={selected.includes(z.id)} disabled={unavailable(z.surface)} onChange={e => setSelected(porous ? [z.id] : e.target.checked ? [...selected, z.id] : selected.filter(id => id !== z.id))} />{z.name}{unavailable(z.surface) ? " · bukan Beton/Aspal" : ""}</label>)}
    <small id="target-guidance" className="target-guidance">{porous ? `Pilih satu zona Beton/Aspal. Luas yang diganti boleh hanya sebagian${area ? `; luas ${zone!.name} tercatat ${fmt(Number(area))} m²` : ""}.` : "Pilih sumber air yang Anda rencanakan untuk intervensi ini."}</small>
    {missing && !selected.length && <small className="field-error target-guidance">Pilih zona yang ingin ditangani.</small>}
  </fieldset>;
}
