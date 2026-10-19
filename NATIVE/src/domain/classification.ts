import type { Surface } from "./model";
import { projectV2Schema, type ProjectV2 } from "./projectV2";
import { predictionSchema, type Prediction } from "./v2-primitives";
import { invalidateRoofRouting } from "./roofRouting";

export type ClassificationContext = {
  projectId: string;
  zoneId: string;
  zoneRevision: number;
};
export function confirmClassification(
  project: ProjectV2,
  context: ClassificationContext,
  surface: Surface,
  prediction: Prediction | null,
  recordId: string,
): ProjectV2 {
  const zone = project.zones.find((z) => z.id === context.zoneId);
  if (
    project.id !== context.projectId ||
    !zone ||
    zone.revision !== context.zoneRevision
  )
    throw new Error("STALE_REQUEST: zona berubah. Pilih dan konfirmasi ulang.");
  const validated =
    prediction === null ? null : predictionSchema.parse(prediction);
  const base = zone.surface === "roof" && surface !== "roof"
    ? invalidateRoofRouting(project, zone.id)
    : project;
  const corrected = validated !== null && validated.predictedClass !== surface;
  const previous = base.classificationRecords.find(
    (r) => r.id === zone.classificationRecordId,
  );
  const record = {
    id: recordId,
    zoneId: zone.id,
    revision: (previous?.revision ?? 0) + 1,
    predecessorId: zone.classificationRecordId,
    origin: validated ? "surface-assist" : "manual",
    evidenceClass: "USER_INPUT",
    state: corrected ? "corrected" : "confirmed",
    confirmedClass: surface,
    correctedClass: corrected ? surface : null,
    prediction: validated,
    note: "",
  };
  const resetCoefficient = zone.surface !== null && zone.surface !== surface;
  return projectV2Schema.parse({
    ...base,
    parameters: resetCoefficient
      ? base.parameters.map((parameter) => parameter.id === zone.coefficient.id
          ? { ...parameter, value: null, evidence: "UNKNOWN" as const, source: "", note: "", applicability: "", revision: parameter.revision + 1 }
          : parameter)
      : base.parameters,
    zones: base.zones.map((z) =>
      z.id === zone.id
        ? {
            ...z,
            surface,
            coefficient: resetCoefficient
              ? { ...z.coefficient, evidence: "UNKNOWN" as const }
              : z.coefficient,
            classificationRecordId: recordId,
            revision: z.revision + 1,
          }
        : z,
    ),
    classificationRecords: [...base.classificationRecords, record],
  });
}
