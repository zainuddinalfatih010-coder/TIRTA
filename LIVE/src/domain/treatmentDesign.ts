import type { ProjectV2 } from './projectV2';
import { projectV2Schema } from './projectV2';
import type { ComponentVariant } from './intervention-contract';
import { emptyInterventionEvidence, type InterventionEvidence } from './scientificContract';
import { initializeScience } from './scientificAuthoring';
import { emptyInput, saveComponent } from './planningAuthoring';
import { planningSpaceId, sharedPlanningSpace } from './planningWorkspace';
import { containsPoint } from './geometry';
import type { Point } from './model';

/** Pembina rule: Biopori may be installed on any declared surface except roofs. */
export function bioporiInstallationAllowed(surface: ProjectV2['zones'][number]['surface']) {
  return surface !== 'roof';
}

/** A schematic marker may not contradict a declared Biopori installation. */
export function treatmentPlacementIssue(p: ProjectV2, c: ComponentVariant, point: Point): string | null {
  if (c.family !== 'infiltration' || c.infiltrationType !== 'biopori') return null;
  const site = p.zones.find(z => z.id === c.treatment?.installationZoneId);
  if (!site || !bioporiInstallationAllowed(site.surface)) return 'Pilih lokasi pemasangan Biopori selain Atap terlebih dahulu.';
  return containsPoint(site.polygon, point) ? null : 'Letakkan Biopori di zona yang dipilih sebagai lokasi pemasangan. Posisi sebelumnya dipertahankan.';
}

/** Compatibility projection: targets remains the single stored authority, with family-specific roles. */
export function treatmentRoles(c: ComponentVariant) {
  return { sourceZoneIds: c.family === 'permeable' ? [] : c.targets, conversionZoneId: c.family === 'permeable' ? c.targets[0] ?? null : null, installationZoneId: c.treatment?.installationZoneId ?? null };
}
export function referencedSoil(p: ProjectV2, c: ComponentVariant, e: InterventionEvidence) {
  const r = e.soilReference;
  if (!r) return { number: e.soilInfiltration, stale: false };
  const context = p.science?.surfaces[r.zoneId]?.soil.infiltration;
  const stale = c.treatment?.installationZoneId !== r.zoneId || !p.zones.some(z => z.id === r.zoneId && (z.surface === 'soil' || z.surface === 'vegetation')) || !context || JSON.stringify(context) !== JSON.stringify(r.observation);
  return { number: stale ? null : r.observation, stale };
}
export function sharedSources(p: ProjectV2, c: ComponentVariant) {
  return p.components.filter(other => other.enabled && other.id !== c.id && other.family !== 'permeable' && c.family !== 'permeable' && other.targets.some(id => c.targets.includes(id)));
}
export function treatmentSentence(p: ProjectV2, c: ComponentVariant) {
  const names = c.targets.map(id => p.zones.find(z => z.id === id)?.name ?? 'Zona terhapus').join(' + ');
  const site = p.zones.find(z => z.id === c.treatment?.installationZoneId)?.name;
  if (c.family === 'permeable') return `${names || 'Permukaan belum dipilih'} diubah menjadi permukaan berpori. Luas penggantian dinyatakan terpisah.`;
  return `Air dari ${names || 'sumber yang belum dipilih'} ditangani dengan ${c.name}${site ? ` pada ${site}` : '; lokasi penerapan belum dipilih'}.`;
}
export function addTreatment(p: ProjectV2, family: ComponentVariant['family'], scenarioId: string, sourceZoneId?: string, biopori = false): { project: ProjectV2; id: string } {
  const base = { storage: 'tank', infiltration: 'soak', 'rain-garden': 'garden', permeable: 'porous' }[family];
  let id = base, n = 1;
  while (p.components.some(c => c.id === id)) id = `${base}-${++n}`;
  const name = biopori ? 'Biopori' : { storage: 'Tangki', infiltration: 'Sumur / area resapan', 'rain-garden': 'Rain garden', permeable: 'Permukaan berpori' }[family];
  const zone = p.zones.find(z => z.id === sourceZoneId);
  const targets = zone && (family !== 'permeable' || zone.surface === 'paved') ? [zone.id] : [];
  // Human numbering belongs to the displayed method, independently of internal IDs.
  const names = new Set(p.components.filter(c => c.family === family && (c.family !== 'infiltration' || (c.infiltrationType === 'biopori') === biopori)).map(c => c.name));
  let humanName = name, suffix = 1;
  while (names.has(humanName)) humanName = `${name} ${++suffix}`;
  const next = saveComponent(sharedPlanningSpace(initializeScience(p)), { id, name: humanName, family, targets, siteId: planningSpaceId(p), connection: '', applicability: '', cost: emptyInput(), area: emptyInput(), capacity: emptyInput(), scenarioId, reuse: null, infiltrationType: biopori ? 'biopori' : undefined, treatment: { installationZoneId: family === 'permeable' ? targets[0] ?? null : null, sharedSourceMode: 'unresolved', allocationNote: '', catchmentReviewed: null } });
  next.optionGroups.push({ id: `choice-${id}`, name, enabled: true, choices: [{ id: 'off', name: 'Tidak dipakai', enabled: true, componentIds: [] }, { id: 'on', name, enabled: true, componentIds: [id] }] });
  next.science!.interventions[id] = emptyInterventionEvidence();
  return { project: projectV2Schema.parse(next), id };
}
export function porousConsistency(p: ProjectV2, zoneId: string): string[] {
  if (p.zones.find(z => z.id === zoneId)?.surface !== 'porous') return [];
  const c = p.science?.surfaces[zoneId]?.porous;
  return [
    ...(c?.clogging === 'observed' ? ['Penyumbatan tercatat. Periksa kembali apakah C masih sesuai kondisi sekarang; TIRTA tidak mengubah C otomatis.'] : []),
    ...(!c?.system.trim() || !c?.base.trim() || !c?.subgrade.trim() ? ['Sistem atau lapisan bawah belum lengkap. Kelas berpori saja tidak membuktikan kinerja resapannya.'] : []),
  ];
}
