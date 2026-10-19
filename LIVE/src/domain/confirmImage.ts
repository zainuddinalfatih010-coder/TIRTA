import type { Surface } from "./model";
import { confirmClassification, type ClassificationContext } from "./classification";
import { projectV2Schema, type ProjectV2 } from "./projectV2";
import { imageObservationSchema, type ImageObservation } from "./imageObservations";

export function confirmImage(project: ProjectV2, context: ClassificationContext, observation: Omit<ImageObservation, "state" | "confirmedClass" | "classificationRecordId">, surface: Surface | null, recordId: string): ProjectV2 {
  const zone = project.zones.find(z => z.id === context.zoneId);
  if (project.id !== context.projectId || !zone || zone.revision !== context.zoneRevision || observation.zoneId !== context.zoneId || observation.zoneRevision !== context.zoneRevision)
    throw new Error("Zona atau proyek berubah sejak gambar diproses. Proses ulang sebelum konfirmasi.");
  if ((project.imageObservations?.length ?? 0) >= 20) throw new Error("Maksimum 20 hasil citra per proyek; tidak ada hasil lama yang dihapus otomatis.");
  const p = surface ? confirmClassification(project, context, surface, null, recordId) : structuredClone(project);
  const entry = imageObservationSchema.parse({ ...observation, state: surface === null ? "rejected" : observation.suggestedClass === null || surface === observation.suggestedClass ? "confirmed" : "corrected", confirmedClass: surface, classificationRecordId: surface ? recordId : null });
  const classification = p.classificationRecords.find(r => r.id === recordId);
  if (classification && classification.origin !== "demo") classification.note = `Konfirmasi pengguna setelah meninjau analisis visual lokal ${observation.algorithm}; citra SHA-256 ${observation.sha256}. Tidak ada model klasifikasi atau confidence yang digunakan. ${observation.source}`;
  p.imageObservations = [...(p.imageObservations ?? []), entry];
  return projectV2Schema.parse(p);
}
