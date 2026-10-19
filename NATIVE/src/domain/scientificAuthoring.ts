import { routingIssues } from './sourceRouting';
import { projectV2Schema, type ProjectV2 } from './projectV2';
import { emptyScience, scientificRevisionSchema, scientificNumberSchema, type ScientificRevision, type ScientificNumber } from './scientificContract';

/** Adds only explicit unknowns and review markers, never scientific numbers. */
export function initializeScience(p: ProjectV2): ProjectV2 {
  if (p.science) return p;
  return projectV2Schema.parse({ ...p, science: { ...emptyScience(), legacyNeedsVerification: p.components.map(c => c.id).sort() } });
}
export function updateScience(p: ProjectV2, change: (science: ScientificRevision) => void): ProjectV2 {
  const next = structuredClone(initializeScience(p));
  change(next.science!);
  scientificRevisionSchema.parse(next.science);
  const parsed = projectV2Schema.parse(next);
  const issues = routingIssues(parsed);
  if (issues.length) throw new Error(issues.join(" "));
  return parsed;
}
export function rainfallAverageIntensity(depth: number | null, duration: ScientificNumber | undefined) {
  if (depth === null || !Number.isFinite(depth) || depth < 0 || !duration || !scientificNumberSchema.safeParse(duration).success || duration.unit !== 'minutes' || duration.value === null || duration.value <= 0) return null;
  const average = depth / (duration.value / 60);
  if (!Number.isFinite(average)) return null;
  return { value: average, unit: 'mm/h' as const, origin: 'derived' as const, meaning: 'intensitas rata-rata kejadian' as const, source: duration.source };
}
export function observedNumber(raw: string, unit: ScientificNumber['unit'], origin: ScientificNumber['origin'], source: string, method = '', date = ''): ScientificNumber {
  if (!raw.trim()) return { value: null, unit, origin: 'unknown', source: '', method: '', date: '' };
  const value = Number(raw);
  if ((unit === 'minutes' && value <= 0) || !Number.isFinite(value)) throw new Error('Durasi harus positif; angka lain harus valid. Kosong tetap belum diketahui.');
  return scientificNumberSchema.parse({ value, unit, origin, source: source.trim(), method, date });
}
export function scientificScenarioContext(p: ProjectV2, scenarioId: string) {
  const scenario = p.scenarios.find(s => s.id === scenarioId);
  const ref = scenario && (scenario.overrides.find(o => o.baseParameterId === scenario.rainfall.id)?.replacement ?? scenario.rainfall);
  return { rainfallMm: p.parameters.find(x => x.id === ref?.id)?.value ?? null, durationMinutes: p.science?.rainfall[scenarioId]?.value ?? null };
}
