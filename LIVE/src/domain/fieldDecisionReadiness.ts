import type { ProjectV2 } from './projectV2';
import type { Issue } from './model';
import type { ComponentVariant } from './intervention-contract';
import { assessIntervention, type ScreeningFinding } from './feasibility';
import { productionBaseline } from './productionBaseline';
import { evaluateEventPlan, evaluatePlan, planningFingerprint, planningParameterValue, snapshotPlan, type Plan } from './planningEngine';
import { workflowReadiness, type ReadinessIssue } from './workflowReadiness';

export type FieldDecisionSection = 'parcel' | 'rainfall' | 'connection' | 'capacity' | 'site' | 'resources' | 'constraints' | 'selection';
export type FieldDecisionAction = ReadinessIssue & {
  section: FieldDecisionSection;
  scenarioId: string;
  ruleId: string;
  severity: 'missing' | 'incompatible' | 'stale';
  /** The next fact to establish; never an inferred scientific input. */
  question: string;
  consequence: string;
  label: string;
};
export type FieldPackageReadiness = {
  calculationReady: boolean;
  comparisonReady: boolean;
  verificationReady: boolean;
  verificationChecks: ScreeningFinding[];
  calculationActions: FieldDecisionAction[];
  comparisonActions: FieldDecisionAction[];
  actions: FieldDecisionAction[];
};
export type FieldTreatmentReadiness = FieldPackageReadiness & {
  id: string;
  name: string;
  family: ComponentVariant['family'];
  status: 'inactive' | 'retired' | 'needs-data' | 'incompatible' | 'calculation-ready' | 'comparison-ready';
  /** Implementation caveats remain distinct from numerical/comparison blockers. */
  fieldConditions: string[];
};
export type FieldDecisionState = {
  baseline: { ready: boolean; actions: FieldDecisionAction[] };
  treatments: FieldTreatmentReadiness[];
  activePackage: FieldPackageReadiness;
  selected: FieldPackageReadiness & { status: 'none' | 'current' | 'stale' | 'blocked'; ready: boolean; planId?: string };
};

const unique = (actions: FieldDecisionAction[]) => actions.filter((action, index, all) => all.findIndex(other => other.stage === action.stage && other.section === action.section && other.field === action.field && other.componentId === action.componentId && other.zoneId === action.zoneId && other.scenarioId === action.scenarioId && other.severity === action.severity) === index);
function action(issue: ReadinessIssue, scenarioId: string, section: FieldDecisionSection, ruleId: string, question: string, consequence: string, label: string, severity: FieldDecisionAction['severity'] = 'missing'): FieldDecisionAction {
  return { ...issue, section, scenarioId, ruleId, question, consequence, label, severity };
}
function baselineAction(issue: ReadinessIssue, scenarioId: string) {
  const rain = issue.stage === 'rain', project = issue.stage === 'project';
  return action(issue, scenarioId, rain ? 'rainfall' : 'parcel', 'BASELINE', project ? 'Persil mana yang ingin Anda periksa?' : rain ? 'Hujan mana yang ingin Anda uji?' : 'Bagian persil mana yang masih perlu dijelaskan?', 'Limpasan awal belum dapat dihitung dari data ini.', project ? 'Buat atau buka proyek' : rain ? 'Lengkapi hujan' : issue.zoneId ? 'Lengkapi area ini' : 'Lengkapi persil');
}
function resourceTarget(p: ProjectV2, c?: ComponentVariant, finding?: ScreeningFinding): { field: string; section: FieldDecisionSection; question: string; label: string } {
  const known = (ref: ComponentVariant['totalCost'], unit: ComponentVariant['totalCost']['unit']) => {
    try { planningParameterValue(p.parameters, ref, unit, 'Parameter'); return true; } catch { return false; }
  };
  if (finding?.field === 'budget' || finding?.field === 'area' || finding?.field === 'land') {
    if (finding.field === 'budget') return { field: 'budget', section: 'constraints', question: 'Biaya mana yang dapat dikurangi, atau apakah batas biaya perlu dikoreksi?', label: 'Tinjau batas biaya' };
    return { field: c ? 'area' : 'land', section: c ? 'resources' : 'constraints', question: 'Apakah ruang pemasangan perlu dikurangi atau lokasinya dipindahkan?', label: 'Tinjau ruang pemasangan' };
  }
  if (c && !known(c.totalCost, 'IDR')) return { field: 'cost', section: 'resources', question: 'Berapa biaya penanganan ini?', label: 'Isi biaya penanganan' };
  if (c && !known(c.occupiedArea, 'm2')) return { field: 'area', section: 'resources', question: 'Berapa luas yang dipakai pemasangannya?', label: 'Isi ruang pemasangan' };
  if (!known(p.constraints.budget, 'IDR')) return { field: 'budget', section: 'constraints', question: 'Berapa batas biaya yang dapat digunakan?', label: 'Tinjau batas biaya' };
  if (!known(p.constraints.usableArea, 'm2')) return { field: 'land', section: 'constraints', question: 'Berapa ruang yang tersedia untuk penanganan?', label: 'Tinjau batas lahan' };
  return { field: c ? 'area' : 'constraints', section: c ? 'resources' : 'constraints', question: 'Apakah kebutuhan ruang sesuai lokasi pemasangan?', label: 'Tinjau ruang pemasangan' };
}
function screeningAction(p: ProjectV2, c: ComponentVariant, sid: string, finding: ScreeningFinding, incompatible = false): FieldDecisionAction {
  const issue: ReadinessIssue = { stage: 'interventions', field: 'component', componentId: c.id, message: `${c.name}: ${finding.message}` };
  let section: FieldDecisionSection = 'site', question = 'Kondisi apa yang perlu diperiksa di lokasi ini?', label = 'Tinjau kondisi lokasi';
  if (finding.ruleId === 'RESOURCE') {
    const target = resourceTarget(p, c, finding);
    issue.field = target.field; section = target.section; question = target.question; label = target.label;
  } else if (finding.ruleId === 'PERFORMANCE' || finding.ruleId === 'CAPACITY') {
    issue.field = finding.field ?? 'capacity'; section = 'capacity';
    question = ['capacityBasis','capacitySource'].includes(issue.field) ? 'Angka kapasitas ini berasal dari pengukuran, acuan, atau asumsi Anda?'
      : issue.field === 'performanceMethod' ? 'Bagaimana dan kapan kapasitas ini diukur?'
        : issue.field === 'performanceContext' ? 'Apakah dasar kapasitas masih berlaku untuk hujan yang diubah ini?'
          : c.family === 'storage' ? 'Berapa ruang kosong tangki yang tersedia untuk hujan ini?' : 'Berapa kapasitas resapan per kejadian yang dapat didukung untuk hujan ini?';
    label = 'Tinjau kapasitas';
  } else if (finding.ruleId === 'CONNECTION') {
    issue.field = finding.field ?? 'connection'; section = 'connection'; question = issue.field === 'source' ? 'Air dari area mana yang akan ditangani?' : issue.field === 'catchmentReviewed' ? 'Apakah jalur ini melayani seluruh area sumber yang dipilih?' : 'Dari area mana air ditangani, dan bagaimana air mencapai penanganan ini?'; label = 'Tinjau sumber dan penyaluran';
  } else if (finding.ruleId === 'BIOPORI_SITE') {
    issue.field = 'installation'; section = 'connection'; question = 'Di area non-atap mana Biopori akan dipasang?'; label = 'Pilih lokasi Biopori';
  } else if (finding.ruleId === 'SOIL') {
    issue.field = 'soil'; issue.zoneId = c.treatment?.installationZoneId ?? undefined;
    question = incompatible ? 'Apakah lokasi atau jenis penanganan perlu diganti karena tanah ini tidak mendukung resapan?' : 'Apakah kemampuan resapan tanah di lokasi pemasangan sudah diperiksa?'; label = 'Tinjau bukti tanah';
  } else if (finding.ruleId === 'GROUNDWATER') {
    issue.field = 'groundwater'; issue.zoneId = c.treatment?.installationZoneId ?? undefined;
    question = incompatible ? 'Apakah perlu lokasi atau jenis penanganan lain untuk kondisi air tanah ini?' : 'Apakah kondisi air tanah di lokasi pemasangan sesuai untuk resapan?'; label = 'Tinjau kondisi air tanah';
  } else {
    issue.field = finding.ruleId.toLowerCase();
  }
  return action(issue, sid, section, finding.ruleId, question, finding.ruleId === 'RESOURCE' ? 'Dampak air dan kelayakan biaya/lahan diperiksa terpisah; paket belum dapat dibandingkan.' : incompatible ? 'Penanganan ini tidak dapat digunakan dengan kondisi yang dinyatakan.' : 'Dampak penanganan belum dapat dihitung tanpa data ini.', label, incompatible ? 'incompatible' : 'missing');
}
function packageState(calculationReady: boolean, comparisonReady: boolean, calculationActions: FieldDecisionAction[], comparisonActions: FieldDecisionAction[], verificationChecks: ScreeningFinding[] = []): FieldPackageReadiness {
  const priority = (a: FieldDecisionAction) => a.field === 'installation' ? 0 : a.field === 'source' ? 1 : a.section === 'connection' ? 2 : a.field === 'capacity' ? 3 : a.section === 'capacity' ? 4 : a.section === 'site' ? 5 : 6;
  const ordered = (a: FieldDecisionAction[]) => unique(a).sort((x,y)=>priority(x)-priority(y));
  return { calculationReady, comparisonReady, verificationReady:calculationReady&&!verificationChecks.length, verificationChecks, calculationActions: ordered(calculationActions), comparisonActions: ordered(comparisonActions), actions: ordered([...calculationActions, ...comparisonActions]) };
}
function ledgerAction(p: ProjectV2, sid: string, issue: Issue): FieldDecisionAction {
  const component = p.components.find(c => c.id === issue.componentId || c.totalCost.id === issue.parameterId || c.occupiedArea.id === issue.parameterId || Object.values(c.performanceByScenario).some(perf => ('availableStorage' in perf ? perf.availableStorage.id : 'infiltrationCapacity' in perf ? perf.infiltrationCapacity.id : perf.additionalInfiltrationCapacity.id) === issue.parameterId));
  const field = issue.field ?? (issue.parameterId === p.constraints.budget.id ? 'budget' : issue.parameterId === p.constraints.usableArea.id ? 'land' : undefined);
  if (field && !['cost','area','land','budget'].includes(field)) {
    const connection = ['installation','source','connection','sharedSourceMode'].includes(field);
    const capacity = ['capacity','capacityBasis','reuse'].includes(field);
    const section: FieldDecisionSection = connection ? 'connection' : capacity ? 'capacity' : field === 'site' ? 'site' : 'constraints';
    const question = field === 'minInstallations' ? 'Berapa penanganan minimum yang memang ingin Anda gunakan?' : 'Bagian mana dari rencana ini yang perlu dikoreksi?';
    return action({stage:'interventions',componentId:component?.id,field,message:issue.message},sid,section,issue.ruleId ?? 'PLAN',question,'Paket belum dapat digunakan sebelum masalah ini diperbaiki.',field === 'minInstallations' ? 'Tinjau jumlah minimum' : connection ? 'Tinjau sumber dan lokasi' : capacity ? 'Tinjau kapasitas' : 'Tinjau rencana','incompatible');
  }
  const target = resourceTarget(p, component, { ruleId: 'RESOURCE', field, claimId: '', evidenceIds: [], message: issue.message });
  return action({ stage: 'interventions', componentId: component?.id, field: target.field, message: issue.message }, sid, target.section, issue.ruleId ?? 'PLAN', target.question, 'Paket ini belum dapat digunakan sebagai rencana.', target.label, 'incompatible');
}
/** A presentation projection of the existing validators; owns no arithmetic or readiness bypass. */
export function fieldDecisionReadiness(p: ProjectV2 | null, scenarioId: string): FieldDecisionState {
  const empty = packageState(false, false, [], []);
  if (!p) {
    const first = baselineAction({ stage: 'project', field: 'projectName', message: 'Buat atau buka proyek terlebih dahulu.' }, scenarioId);
    return { baseline: { ready: false, actions: [first] }, treatments: [], activePackage: { ...empty, actions: [first], calculationActions: [first] }, selected: { ...empty, status: 'none', ready: false, actions: [first] } };
  }
  const workflow = workflowReadiness(p, scenarioId, { evaluated: 0, rows: [], issues: [] });
  const baseline = productionBaseline(p, scenarioId);
  const baselineIssues = workflow.rain.length ? workflow.rain : !baseline.ok ? workflow.interventions : [];
  const baseActions = baselineIssues.map(i => baselineAction(i, scenarioId));
  const baselineReady = baseline.ok && !baseActions.length;
  const active = p.components.filter(c => c.enabled);
  const requiredScenarios = [...new Set([scenarioId, ...p.constraints.requiredScenarioIds])];
  const assess = (plan: Plan, sid: string, resources: boolean) => plan.components.filter(c => c.enabled).flatMap(c => {
    const f = assessIntervention(p, c, sid, plan.parameters, plan.scientificEvidence?.[c.id], resources, plan.components.filter(c => c.enabled));
    return [...f.reasons.map(x => screeningAction(p, c, sid, x, true)), ...f.missing.map(x => screeningAction(p, c, sid, x))];
  });
  const evaluate = (plan: Plan, sids: string[]): FieldPackageReadiness => {
    if (!baselineReady) return packageState(false, false, baseActions, []);
    let calculationReady = true, comparisonReady = true;
    const calculationActions: FieldDecisionAction[] = [], comparisonActions: FieldDecisionAction[] = [];
    for (const sid of sids) {
      if (sid !== scenarioId && !productionBaseline(p, sid).ok) {
        const other = workflowReadiness(p, sid, { evaluated: 0, rows: [], issues: [] });
        const issues = other.rain.length ? other.rain : other.interventions;
        const actions = issues.map(i => baselineAction(i, sid));
        calculationReady = false; comparisonReady = false;
        calculationActions.push(...actions); comparisonActions.push(...actions);
        continue;
      }
      const water = evaluateEventPlan(p, plan, sid), comparison = evaluatePlan(p, plan, sid);
      if (!water.ok) {
        calculationReady = false;
        const next = assess(plan, sid, false);
        calculationActions.push(...(next.length ? next : water.issues.map(i => ledgerAction(p, sid, i))));
      }
      if (!comparison.ok) {
        comparisonReady = false;
        const next = assess(plan, sid, true);
        comparisonActions.push(...(next.length ? next : comparison.issues.map(i => ledgerAction(p, sid, i))));
      }
    }
    const verificationChecks=sids.flatMap(sid=>plan.components.filter(c=>c.enabled).flatMap(c=>assessIntervention(p,c,sid,plan.parameters,plan.scientificEvidence?.[c.id],false,plan.components.filter(item=>item.enabled)).conditions));
    return packageState(calculationReady, comparisonReady, calculationActions, comparisonActions,verificationChecks);
  };
  const treatments = p.components.map(c => {
    if (!c.enabled) return { ...empty, id: c.id, name: c.name, family: c.family, status: 'inactive' as const, fieldConditions: [] };
    const plan = snapshotPlan(p, [c.id], `readiness-${c.id}`, c.name);
    const state = evaluate(plan, [scenarioId]);
    const f = baselineReady ? assessIntervention(p, c, scenarioId, p.parameters, undefined, false, [c]) : null;
    const status = state.comparisonReady ? 'comparison-ready' as const : state.calculationReady ? 'calculation-ready' as const : state.actions.some(a => a.severity === 'incompatible') ? 'incompatible' as const : 'needs-data' as const;
    return { ...state, id: c.id, name: c.name, family: c.family, status, fieldConditions: f?.conditions.map(x => x.message) ?? [] };
  });
  const current = snapshotPlan(p, active.map(c => c.id), 'readiness-current', 'Penanganan aktif');
  const activePackage = evaluate(current, requiredScenarios);
  let selected: FieldDecisionState['selected'];
  if (!p.selectedPlan) {
    const first = action({ stage: 'alternatives', field: 'alternatives', message: 'Belum ada rencana pilihan. Tinjau alternatif yang dapat dihitung, lalu pilih sesuai kebutuhan Anda.' }, scenarioId, 'selection', 'SELECTION', 'Pilihan mana yang paling sesuai kebutuhan dan batas Anda?', 'Menyimpan penanganan belum berarti memilih rencana.', 'Tinjau alternatif');
    selected = { ...empty, status: 'none', ready: false, actions: baselineReady ? [first] : baseActions };
  } else {
    const state = evaluate(p.selectedPlan.definition, requiredScenarios);
    const stale = p.selectedPlan.reviewedInputFingerprint !== planningFingerprint(p);
    const first = action({ stage: 'alternatives', field: 'alternatives', message: 'Data berubah sejak rencana dipilih. Tinjau dampak dan batas terbaru, lalu pilih kembali.' }, scenarioId, 'selection', 'STALE', 'Apakah rencana lama masih sesuai data saat ini?', 'Pilihan lama tetap tersimpan; hasilnya belum menjadi keputusan untuk data terbaru.', 'Tinjau kembali pilihan', 'stale');
    selected = { ...state, status: stale ? 'stale' : state.comparisonReady ? 'current' : 'blocked', ready: !stale && state.comparisonReady, planId: p.selectedPlan.definition.id, actions: stale ? unique([first, ...state.actions]) : state.actions };
  }
  return { baseline: { ready: baselineReady, actions: unique(baseActions) }, treatments, activePackage, selected };
}
