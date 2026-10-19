import type { ProjectV2 } from './projectV2';
import { emptySurfaceContext, fieldObservationSchema, type FieldObservation } from './scientificContract';
import { updateScience } from './scientificAuthoring';

export const fieldObservationLabels: Record<FieldObservation['condition'], string> = {
  unknown: 'Belum diketahui', ponding: 'Air sering tertahan / menggenang',
  'concentrated-runoff': 'Aliran air terkumpul di sini', 'no-known-issue': 'Belum ada masalah yang diketahui',
};
export function recordFieldObservation(project: ProjectV2, zoneId: string, observation: FieldObservation): ProjectV2 {
  if (!project.zones.some(z => z.id === zoneId)) throw new Error('Area tidak tersedia. Pilih kembali area yang akan dicatat.');
  const parsed = fieldObservationSchema.parse(observation);
  return updateScience(project, science => {
    science.surfaces[zoneId] ??= emptySurfaceContext();
    science.surfaces[zoneId]!.fieldObservation = parsed;
  });
}
export function fieldObservationGuidance(project: ProjectV2, zoneIds: readonly string[]) {
  const zones = project.zones.filter(z => zoneIds.includes(z.id));
  const ponding = zones.find(z => project.science?.surfaces[z.id]?.fieldObservation?.condition === 'ponding');
  if (ponding) return {
    reason: `Air sering tertahan pada ${ponding.name}. Pengamatan ini belum menjelaskan penyebab atau kemampuan tanah menyerap air.`,
    nextQuestion: `Di bagian mana air tertahan, dan dari area mana air itu datang?`,
    field: 'soil' as const,
  };
  const concentrated = zones.find(z => project.science?.surfaces[z.id]?.fieldObservation?.condition === 'concentrated-runoff');
  if (concentrated) return {
    reason: `Aliran terkumpul pada ${concentrated.name}. Jalur sumber perlu dikonfirmasi sebelum memasukkannya ke penanganan.`,
    nextQuestion: 'Dari area mana air datang, dan apakah jalurnya benar-benar terhubung ke penanganan?',
    field: 'connection' as const,
  };
  return null;
}
export function fieldObservationReport(project: ProjectV2): string[] {
  return project.zones.flatMap(z => {
    const o = project.science?.surfaces[z.id]?.fieldObservation;
    if (!o || o.condition === 'unknown') return [];
    return [`${z.name}: ${fieldObservationLabels[o.condition]}.${o.note ? ` ${o.note}` : ''}`];
  });
}
export const fieldObservationLimitation = 'Pengamatan ini tidak menentukan kedalaman genangan, laju resapan atau sambungan air. Penurunan volume limpasan belum membuktikan genangan di lokasi akan hilang.';
