import { projectV2Schema, type ProjectV2 } from './projectV2';
import { addTreatment } from './treatmentDesign';
import { readInput, saveComponent } from './planningAuthoring';
import { assessIntervention } from './feasibility';

/** A removed current recipient cannot remain an actionable water destination. */
export function clearInactiveDestinations(p: ProjectV2): ProjectV2 {
  const next = structuredClone(p);
  const active = new Set(next.components.filter(c => c.enabled).map(c => c.id));
  if (next.science) {
    for (const evidence of Object.values(next.science.interventions)) {
      if (evidence?.overflow.kind === 'intervention' && !active.has(evidence.overflow.id)) evidence.overflow = {kind:'unknown'};
    }
    for (const connection of next.science.connections) {
      if (connection.destination.kind === 'intervention' && !active.has(connection.destination.id)) {
        connection.destination = {kind:'unknown'};
        connection.origin = 'unknown';
        connection.source = '';
      }
    }
  }
  // manualPlans and selectedPlan are immutable historical declarations.
  return projectV2Schema.parse(next);
}

/** Describe only relationships actually invalidated by the current transaction. */
export function invalidatedDestinationLabels(before: ProjectV2, after: ProjectV2): string[] {
  const labels = new Set<string>();
  const active = new Set(after.components.filter(c => c.enabled).map(c => c.id));
  for (const [id, evidence] of Object.entries(before.science?.interventions ?? {})) {
    if (active.has(id) && evidence?.overflow.kind === 'intervention' && after.science?.interventions[id]?.overflow.kind === 'unknown') {
      labels.add(`${before.components.find(c => c.id === id)?.name ?? 'Penanganan'} (luapan)`);
    }
  }
  for (const route of before.science?.connections ?? []) {
    if (route.candidateId && !active.has(route.candidateId)) continue;
    if (route.destination.kind === 'intervention' && after.science?.connections.find(c => c.id === route.id)?.destination.kind === 'unknown') {
      const zone = before.zones.find(z => z.id === route.sourceZoneId);
      labels.add(zone?.name ?? 'Zona sumber');
    }
  }
  return [...labels];
}

/** Current, calculatable destinations only. Frozen plans remain a separate history. */
export function overflowChoices(p: ProjectV2, id: string, scenarioId: string) {
  return p.components.filter(c => c.id !== id && c.enabled && c.family !== 'permeable' && (() => {
    const assessment = assessIntervention(p,c,scenarioId,p.parameters,undefined,false,[c]);
    return !assessment.missing.length && !assessment.reasons.length;
  })());
}

/** Explicit duplicate action copies estimates, not a claimed second measured installation. */
export function duplicateTreatment(p: ProjectV2, sourceId: string, scenarioId: string) {
  const original=p.components.find(c=>c.id===sourceId);
  if (!original) throw new Error('Penanganan tidak tersedia.');
  if (original.family==='permeable') throw new Error('Permukaan berpori adalah konversi zona. Buat penanganan baru agar zona konversinya dipilih secara eksplisit.');
  if (!p.scenarios.some(s=>s.id===scenarioId)) throw new Error('Pilih skenario hujan terlebih dahulu.');
  const added=addTreatment(p,original.family,scenarioId,undefined,original.family==='infiltration' && original.infiltrationType==='biopori');
  const estimate=(input: ReturnType<typeof readInput>) => input.text ? {...input,evidence:input.evidence==='DEMO'?'DEMO' as const:'ASSUMPTION' as const,source:`${input.source} · Disalin dari ${original.name}; periksa untuk pemasangan baru.`} : input;
  const project=saveComponent(added.project,{
    id:added.id,name:`${original.name} (salinan)`.slice(0,120),family:original.family,
    targets:[...original.targets],siteId:original.installationSiteId ?? '',connection:'',applicability:'',
    cost:estimate(readInput(p,original.totalCost)),area:estimate(readInput(p,original.occupiedArea)),
    capacity:{text:'',source:'',evidence:'UNKNOWN'},scenarioId,reuse:null,
    infiltrationType:original.family==='infiltration'?original.infiltrationType:undefined,
    treatment:{installationZoneId:original.treatment?.installationZoneId ?? null,sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:null},
  });
  // addTreatment created empty science, unknown capacity and new parameter/group identities.
  // Never clone physical placement, performance evidence, reuse demand, routes or overflow.
  return {project:projectV2Schema.parse(project),id:added.id};
}
