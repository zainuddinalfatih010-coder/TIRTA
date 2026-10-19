import { evaluatePlan, optimize, planningFingerprint, type Alternative, type Plan } from '../domain/planningEngine';
import { assessPackage } from '../domain/packageRecommendations';
import { productionBaseline } from '../domain/productionBaseline';
import { projectV2Schema, type ProjectV2 } from '../domain/projectV2';
import { runoffHighlights } from '../domain/alternativeHighlight';
import { lookupKnowledge, type HelpDestination } from './knowledge';

export type LocalAnswer = { title: string; text: string; claimIds: string[]; action?: { destination: HelpDestination; label: string }; recommend?: boolean };
export function answerLocally(question: string, project: ProjectV2, scenario: string, alternatives: readonly Alternative[]): LocalAnswer | null {
  const text = question.toLocaleLowerCase('id-ID');
  // Open-ended synthesis is never disguised as a keyword FAQ answer.
  if (/jurnal.*(banding|gabung|sintesis)|analisis mendalam|bagaimana jika|gimana kalau|mengapa.*lebih/.test(text)) return null;
  if (/paket|rekomend|paling efektif|pilihan.*(bagus|baik)/.test(text)) {
    if(!/sisa limpasan.*(rendah|kecil)|limpasan.*(rendah|kecil)/.test(text)) return {title:'Pilih prioritas perbandingan',text:'Pilih sisa limpasan, biaya, atau ruang yang ingin Anda utamakan. TIRTA membandingkan paket yang dapat dihitung dan menampilkan pilihan setara; tidak ada satu paket terbaik untuk semua kebutuhan.',claimIds:[],recommend:true,action:{destination:'alternatives',label:'Bandingkan paket'}};
    const highlights = runoffHighlights(alternatives);
    return { title: highlights.length ? 'Paket dengan sisa limpasan terendah' : 'Data paket belum lengkap', text: highlights.length ? 'Paket ditandai berdasarkan sisa limpasan terendah pada hujan aktif, dengan biaya dan lahan sesuai batas rencana. Tinjau syarat penerapan dan hujan lain sebelum memilih. Paket dengan sisa limpasan yang sama tetap ditampilkan.' : 'Lengkapi hujan, pilihan intervensi, kapasitas, biaya, dan batas rencana terlebih dahulu. TIRTA tidak mengisi angka yang belum diketahui.', claimIds: ['CLAIM-VOLUME', 'CLAIM-STORAGE'], recommend: true, action: { destination: highlights.length ? 'alternatives' : 'interventions', label: highlights.length ? 'Bandingkan semua paket' : 'Lengkapi intervensi' } };
  }
  if (/kurang|belum lengkap|terkunci|tidak bisa lanjut|gak bisa lanjut|ga bisa lanjut/.test(text)) {
    const baseline = productionBaseline(project, scenario);
    const destination: HelpDestination = baseline.ok ? 'interventions' : !project.parcel ? 'studio' : baseline.issues.some(i => i.path.endsWith('.rainfall')) ? 'rain' : 'studio';
    return { title: baseline.ok ? 'Periksa data rencana' : 'Data belum lengkap', text: baseline.ok ? 'Persil dan hujan dapat dihitung. Untuk membandingkan paket, periksa kapasitas tiap skenario, sumbernya, biaya, lahan, dan batas rencana di Intervensi.' : baseline.issues.map(i => i.message).join(' '), claimIds: [], action: { destination, label: 'Buka isian terkait' } };
  }
  const item = lookupKnowledge(question);
  if (!item) return null;
  const baseline = productionBaseline(project, scenario);
  const current = item.id === 'runoff' && baseline.ok ? ` Pada hujan aktif, limpasan awal ${baseline.value.runoffM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m³.` : '';
  return { title: item.title, text: item.explanation + current, claimIds: item.claimId ? [item.claimId] : [], action: item.destination && item.action ? { destination: item.destination, label: item.action } : undefined };
}

export function packageCandidates(project: ProjectV2, alternatives: readonly Alternative[], scenario: string) {
  return alternatives.filter(a => a.plan.components.some(c => c.enabled)).map(a => ({ ...a, assessment: assessPackage(project, a.plan, scenario) })).filter(a => a.assessment.status !== 'blocked' && a.assessment.scenarios.every(s => s.outcome.ok));
}
export type Proposal = { priority?:'residual'|'cost'|'area'; projectId: string; fingerprint: string; scenarioId: string; plan: Plan };
export function proposalFor(project: ProjectV2, scenario: string, plan: Plan, priority: Proposal['priority'] = 'residual'): Proposal {
  return { priority, projectId: project.id, fingerprint: planningFingerprint(project), scenarioId: scenario, plan: structuredClone(plan) };
}
export function applyProposal(project: ProjectV2, scenario: string, proposal: Proposal): ProjectV2 {
  if (project.id !== proposal.projectId || scenario !== proposal.scenarioId || planningFingerprint(project) !== proposal.fingerprint) throw new Error('Data atau hujan berubah. Periksa paket kembali sebelum menerapkan.');
  const current = optimize(project, scenario);
  if (!current.ok || !current.value.alternatives.some(a => a.plan.id === proposal.plan.id && JSON.stringify(a.plan) === JSON.stringify(proposal.plan))) throw new Error('Definisi paket tidak cocok dengan pilihan yang dihitung TIRTA.');
  const assessment = assessPackage(project, proposal.plan, scenario);
  if (assessment.status === 'blocked' || assessment.scenarios.some(s => !s.outcome.ok)) throw new Error('Paket tidak dapat diterapkan dengan data dan batas saat ini.');
  const result = evaluatePlan(project, proposal.plan, scenario);
  if (!result.ok) throw new Error('Paket belum valid. Lengkapi data terlebih dahulu.');
  return projectV2Schema.parse({ ...project, selectedPlan: { definition: proposal.plan, decisionNote: `Ditinjau pengguna dari Tanya TIRTA. Prioritas eksplisit: ${proposal.priority === 'cost' ? 'biaya terendah' : proposal.priority === 'area' ? 'lahan paling sedikit' : 'sisa limpasan terendah'}; kondisi penerapan tetap harus diverifikasi.`, reviewedInputFingerprint: proposal.fingerprint } });
}
