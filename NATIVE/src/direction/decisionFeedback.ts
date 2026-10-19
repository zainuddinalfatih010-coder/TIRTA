import { surfaceLabels } from "../domain/model";
import type { ProjectV2 } from "../domain/projectV2";
import { componentEditorValues, type OptionId } from "./productionBridge";

export function evidenceLabel(evidence: string) {
  const labels: Record<string, string> = {
    MEASURED: "diukur",
    USER_INPUT: "input pengguna",
    SOURCE_DERIVED: "diturunkan dari sumber/dimensi",
    ASSIST_SUGGESTION: "saran asisten, belum dikonfirmasi",
    ASSUMPTION: "asumsi pengguna",
    DEMO: "data demo",
    UNKNOWN: "belum diketahui",
  };
  return labels[evidence] ?? "status sumber tidak dikenali";
}

export function decisionInterpretation(baseline: number, residual: number) {
  const handled = baseline - residual;
  const share = baseline > 0 ? handled / baseline : null;
  return { handled, share };
}

export function decisionVerificationItems(
  project: ProjectV2,
  scenarioId: string,
  optionIds: readonly OptionId[],
) {
  const items: string[] = [];
  const scenario = project.scenarios.find((item) => item.id === scenarioId);
  const rain = scenario && project.parameters.find((item) => item.id === scenario.rainfall.id);
  if (rain?.evidence === "ASSUMPTION")
    items.push("Skenario hujan adalah angka uji yang ditentukan pengguna, bukan prediksi cuaca.");
  for (const zone of project.zones) {
    const coefficient = project.parameters.find((item) => item.id === zone.coefficient.id);
    if (coefficient?.evidence === "ASSUMPTION")
      items.push(`${zone.name}: koefisien limpasan berasal dari asumsi pengguna.`);
  }
  for (const id of optionIds) {
    const values = componentEditorValues(project, id, scenarioId);
    if (!values) continue;
    const soilIntervention = values.component.family === "infiltration" || values.component.family === "rain-garden";
    if (values.capacity.evidence === "ASSUMPTION")
      items.push(soilIntervention
        ? `${values.component.name}: kapasitas adalah asumsi, bukan hasil uji infiltrasi tanah.`
        : `${values.component.name}: kapasitas adalah asumsi untuk satu kejadian hujan.`);
    else if (soilIntervention && values.capacity.text && values.capacity.evidence !== "MEASURED")
      items.push(`${values.component.name}: kapasitas yang dinyatakan bukan hasil uji infiltrasi tanah.`);
  }
  return [...new Set(items)];
}

export function decisionPhotoProvenance(project: ProjectV2) {
  return project.zones.flatMap((zone) => {
    if (!zone.classificationRecordId || !zone.surface) return [];
    const observation = project.imageObservations?.find(
      (image) => image.classificationRecordId === zone.classificationRecordId && image.zoneId === zone.id,
    );
    if (!observation) return [];
    return [
      `${zone.name}: ${surfaceLabels[zone.surface]} — ${observation.state === "corrected" ? "dikoreksi lalu dikonfirmasi pengguna" : "dikonfirmasi pengguna"} setelah analisis foto lokal (${observation.algorithm}).`,
    ];
  });
}
