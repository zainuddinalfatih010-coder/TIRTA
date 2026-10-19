import type { ProjectV2 } from "./projectV2";
import { polygonArea } from "./geometry";

/** Used only by explicit geometry authoring, never by import or validation. */
export function deriveEditedAreas(p: ProjectV2): ProjectV2 {
  if (!p.drawingScale) return p;
  for (const shape of [...(p.parcel ? [p.parcel] : []), ...p.zones]) {
    if (shape.geometryContext === 'schematic-area') continue;
    const parameter = p.parameters.find(v => v.id === shape.area.id);
    if (!parameter) throw new Error("Sumber luas tidak ditemukan.");
    const value = polygonArea(shape.polygon);
    if (shape.id === p.parcel?.id && value > 200) throw new Error("Maksimum luas persil 200 m². Perubahan bentuk ditolak.");
    if (parameter.value !== value || parameter.evidence !== "SOURCE_DERIVED") {
      parameter.value = value;
      parameter.evidence = "SOURCE_DERIVED";
      parameter.source = `Luas polygon pada skala lokal 1 unit = 1 m. ${p.drawingScale.source}`;
      parameter.revision++;
    }
    shape.area = { id: parameter.id, unit: "m2", evidence: "SOURCE_DERIVED" };
    shape.areaMethod = { kind: "direct" };
  }
  return p;
}
