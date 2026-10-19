import type { ProjectV2 } from "./projectV2";
import type { ComponentVariant } from "./intervention-contract";
import { readInput } from "./planningAuthoring";
import { productionBaseline } from "./productionBaseline";
import { assessIntervention } from './feasibility';

export function interventionReview(project: ProjectV2, components: readonly ComponentVariant[], scenario: string) {
  const baseline = productionBaseline(project, scenario);
  return components.filter(c => c.enabled).flatMap(c => {
    const performance = c.performanceByScenario[scenario];
    if (!performance) return [];
    const capacity = readInput(project, "availableStorage" in performance ? performance.availableStorage : "infiltrationCapacity" in performance ? performance.infiltrationCapacity : performance.additionalInfiltrationCapacity, scenario).text;
    if (capacity === "") return [];
    const notes: { componentId: string; kind: "rain" | "capacity"; message: string }[] = [];
    const context = assessIntervention(project,c,scenario,project.parameters,undefined,false,components.filter(item=>item.enabled)).missing.find(f=>f.field==='performanceContext'||f.field==='capacityBasis');
    if (context) notes.push({componentId:c.id,kind:'rain',message:`${c.name}: ${context.message}`});
    if (baseline.ok) {
      const available = baseline.value.zones.filter(z => c.targets.includes(z.id)).reduce((n, z) => n + z.runoffM3, 0);
      if (Number(capacity) > available + 1e-9) notes.push({ componentId: c.id, kind: "capacity", message: `${c.name}: kapasitas ${capacity} m³ melebihi ${available.toLocaleString("id-ID", { maximumFractionDigits: 3 })} m³ limpasan sumber. Tambahan kapasitas belum tentu memberi manfaat. Periksa satuan, spesifikasi, harga dan kebutuhan ruang; mesin tidak membuktikan input realistis.` });
    }
    return notes;
  });
}
