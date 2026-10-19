import {roofGeometryIssues} from './roofGeometry';
import type { ProjectV2 } from './projectV2';
import type { Connection } from './scientificContract';

export type RoutingContext = { componentIds?: readonly string[]; allowHistoricalDestinations?: boolean; allowSemanticRoofStale?: boolean };
export function routingIssues(p: ProjectV2, context: RoutingContext = {}): string[] {
  const selected = context.componentIds ? new Set(context.componentIds) : null;
  const relevant = (id: string) => !selected || selected.has(id);
  const links = (p.science?.connections ?? []).filter(c => !c.candidateId || relevant(c.candidateId));
  const issues: string[] = [];
  const zones = new Set(p.zones.map(z => z.id));
  const interventions = new Set([...p.components, ...p.manualPlans.flatMap(x => x.components), ...(p.selectedPlan?.definition.components ?? [])].map(c => c.id));
  // Schema/import checks remain structural so a stale current link can be retained for repair.
  // Evaluation supplies the selected IDs and then also checks the recipient lifecycle.
  const destinations = !selected || context.allowHistoricalDestinations ? interventions : new Set(p.components.filter(c => c.enabled && c.family !== 'permeable').map(c => c.id));
  const checkDestination = (id: string) => {
    if (!interventions.has(id)) issues.push('Intervensi tujuan luapan tidak tersedia.');
    else if (!destinations.has(id)) issues.push('Tujuan air tidak aktif untuk perencanaan saat ini; pilih ulang penanganan yang tersedia.');
  };
  for (const c of p.components.filter(c => relevant(c.id))) if (c.treatment?.installationZoneId && !zones.has(c.treatment.installationZoneId)) issues.push('Zona lokasi penerapan tidak tersedia.');
  if (new Set(links.map(c => c.id)).size !== links.length) issues.push('Identitas hubungan sumber ganda.');
  if (new Set(links.map(c => `${c.sourceZoneId}:${c.candidateId ?? "existing"}`)).size !== links.length) issues.push('Satu sumber memiliki tujuan bertentangan. Pembagian aliran belum dimodelkan; nyatakan satu jalur, bukan fraksi tebakan.');
  for(const [id,surfaceContext] of Object.entries(p.science?.surfaces??{})){const zone=p.zones.find(z=>z.id===id),r=surfaceContext.roof.routing;if(!r||!zone)continue;if(r.destinationZoneId&&(r.destinationZoneId===id||!zones.has(r.destinationZoneId)))issues.push('Zona penerima atap tidak tersedia.');if(r.status==='confirmed'&&r.polygonFingerprint===JSON.stringify(zone.polygon))issues.push(...roofGeometryIssues(zone.polygon,r,surfaceContext.roof.form,!context.allowSemanticRoofStale));}
  for (const id of Object.keys(p.science?.surfaces ?? {})) if (!zones.has(id)) issues.push('Konteks permukaan merujuk zona yang tidak tersedia.');
  for (const id of Object.keys(p.science?.rainfall ?? {})) if (!p.scenarios.some(x => x.id === id)) issues.push('Durasi merujuk skenario yang tidak tersedia.');
  const observations = p.science?.observations ?? [];
  if (new Set(observations.map(v => v.id)).size !== observations.length) issues.push('Identitas pengamatan lapangan ganda.');
  for (const [id, evidence] of Object.entries(p.science?.interventions ?? {})) {
    if (!relevant(id)) continue;
    if (!interventions.has(id)) issues.push('Bukti merujuk intervensi yang tidak tersedia.');
    if (evidence.soilReference && !zones.has(evidence.soilReference.zoneId)) issues.push('Zona rujukan tanah tidak tersedia.');
    if (evidence.overflow.kind === 'zone' && !zones.has(evidence.overflow.id)) issues.push('Zona tujuan luapan tidak tersedia.');
    if (evidence.overflow.kind === 'intervention') checkDestination(evidence.overflow.id);
    const seen = new Set<string>(); let current = id;
    while (true) {
      if (seen.has(current)) { issues.push('Tujuan luapan membentuk siklus.'); break; }
      seen.add(current); const next = p.science?.interventions[current]?.overflow;
      if (next?.kind !== 'intervention') break;
      checkDestination(next.id);
      current = next.id;
    }
  }
  for (const observation of observations) if (observation.before.date && observation.after.date && observation.after.date < observation.before.date) issues.push('Tanggal sesudah tidak boleh mendahului tanggal sebelum.');
  for (const c of links) {
    if (c.candidateId && !interventions.has(c.candidateId)) issues.push("Rute rencana merujuk intervensi yang tidak tersedia.");
    if (!zones.has(c.sourceZoneId)) issues.push('Zona sumber hubungan sudah tidak tersedia.');
    if (c.destination.kind === 'zone' && !zones.has(c.destination.id)) issues.push('Zona tujuan hubungan tidak tersedia.');
    if (c.destination.kind === 'intervention') {
      const destinationId = c.destination.id;
      const legacySelfRoute = c.candidateId === destinationId && p.components.some(component => component.id === destinationId && component.enabled && component.family === 'permeable');
      // Legacy conversion arithmetic remains inspectable; it cannot become another active overflow recipient.
      if (!legacySelfRoute) checkDestination(destinationId);
    }
  }
  for (const scope of [undefined, ...new Set(links.map(c => c.candidateId).filter(Boolean))]) for (const start of zones) {
    const visited = new Set<string>(); let id = start;
    while (true) {
      if (visited.has(id)) { issues.push('Hubungan antar zona membentuk siklus; periksa jalur sumber.'); break; }
      visited.add(id);
      const c = links.find(c => c.sourceZoneId === id && c.candidateId === scope) ?? links.find(c => c.sourceZoneId === id && !c.candidateId);
      if (c?.destination.kind !== 'zone') break;
      id = c.destination.id;
    }
  }
  return [...new Set(issues)];
}
export function routeForSource(p: ProjectV2, zoneId: string, candidateId?: string): Connection[] {
  const route: Connection[] = [], seen = new Set<string>(); let id = zoneId;
  while (!seen.has(id)) {
    seen.add(id); const c = p.science?.connections.find(c => c.sourceZoneId === id && c.candidateId === candidateId) ?? p.science?.connections.find(c => c.sourceZoneId === id && !c.candidateId);
    if (!c) break;
    route.push(c);
    if (c.destination.kind !== 'zone') break;
    id = c.destination.id;
  }
  return route;
}
export function sourceConnects(p: ProjectV2, zoneId: string, componentId: string, context: RoutingContext = { componentIds: [componentId] }): boolean {
  if (routingIssues(p, context).length) return false;
  const route = routeForSource(p, zoneId, componentId);
  const last = route.at(-1);
  return !!last && last.destination.kind === 'intervention' && last.destination.id === componentId && route.every(c => c.origin !== 'unknown' && !!c.source.trim());
}
