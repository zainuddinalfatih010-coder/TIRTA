import type { ProjectV2 } from './projectV2';
import { allocationSequence, type Plan } from './planningEngine';
import { assessIntervention, feasibilityLabels } from './feasibility';
import { assessFieldEvaluation } from './fieldEvaluation';
import { scientificClaims, authoritativeReferences } from './evidenceRegistry';
import { journalEvidence } from './evidenceCatalog';
export function scientificSummary(p: ProjectV2, plan: Plan, sid: string): string[] {
  return [
    'TINJAUAN ILMIAH — PRA-PERENCANAAN',
    'Non-limpasan bukan otomatis infiltrasi. Model volume bukan debit puncak, banjir atau sertifikasi.',
    'URUTAN NERACA (ATURAN PEMBUKUAN, BUKAN SIMULASI HIDRAULIK)',
    'Konversi berpori lokal dahulu; lainnya sesuai urutan rencana. Target dibaca berurutan; air yang sudah ditangani tidak dihitung lagi.',
    ...allocationSequence(plan).map((c, i) => `${i + 1}. ${c.name}: ${c.targets.map(id => p.zones.find(z => z.id === id)?.name ?? id).join(' → ')}`),
    ...plan.components.filter(c => c.enabled).flatMap(c => {
      const f = assessIntervention(p, c, sid, plan.parameters, plan.scientificEvidence?.[c.id]);
      return [`${c.name}: ${feasibilityLabels[f.status]}`, ...[...f.reasons, ...f.missing, ...f.conditions].map(x => `${x.message} [${x.ruleId}; ${x.evidenceIds.join(', ')}]`), ...f.fieldChecks];
    }),
    'HUBUNGAN SUMBER YANG DINYATAKAN (BUKAN SIMULASI HIDRAULIK)',
    ...(p.science?.connections ?? []).map(c => `${c.sourceZoneId} → ${c.destination.kind}${'id' in c.destination ? `:${c.destination.id}` : ''}; ${c.candidateId ? `opsi:${c.candidateId}` : 'existing'}; ${c.origin}; ${c.source || 'UNKNOWN'}`),
    'DATA TAMBAHAN, ASUMSI DAN UNKNOWN', JSON.stringify(p.science ? { ...p.science, observations: p.science.observations.map(v => ({ ...v, before: { ...v.before, photo: v.before.photo ? '[Foto di cadangan proyek]' : '' }, after: { ...v.after, photo: v.after.photo ? '[Foto di cadangan proyek]' : '' } })) } : { status: 'UNKNOWN' }, null, 2),
    'EVALUASI LAPANGAN DESKRIPTIF',
    ...(p.science?.observations ?? []).filter(v => v.planId === plan.id).map(v => `${v.before.date || 'UNKNOWN'} → ${v.after.date || 'UNKNOWN'}: ${assessFieldEvaluation(v).label}. ${assessFieldEvaluation(v).explanation}`),
    'KLAIM DAN SUMBER',
    ...scientificClaims.map(c => `${c.id}: ${c.wording} Batas: ${c.limitations} [${c.evidenceIds.join(', ')}]`),
    ...journalEvidence.map(e => `${e.id}: ${e.authors.join(', ')} (${e.year}), ${e.title}, ${e.journal}. ${e.url} Batas: ${e.limitations}`),
    ...authoritativeReferences.map(e => `${e.id}: ${e.title}. ${e.url}. ${e.limitation}`),
  ];
}
