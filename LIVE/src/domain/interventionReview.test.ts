import { it, expect } from 'vitest';
import { productionFixture } from '../test/productionFixtures';
import { interventionReview } from './interventionReview';
import { readInput, saveComponent, saveRain } from './planningAuthoring';
import { qualifyScientificFixture } from '../test/scientificFixtures';

// Kept from the retired assistant suite: this tests the independent engine.
it('records rainfall at capacity review and detects same-id rain changes without changing capacity', () => {
  let p = productionFixture();
  p.parameters.find(v => v.id === 'parcel-area')!.value = 200;
  for (let i = 0; i < 5; i++) p.parameters.find(v => v.id === `area-${i}`)!.value = 40;
  const c = p.components.find(c => c.family === 'infiltration')!;
  const s = p.scenarios[0]!;
  p = saveComponent(p, { id: c.id, name: c.name, family: c.family, targets: c.targets, siteId: c.installationSiteId!, connection: c.connectionNote, applicability: 'Hujan saat ditinjau', cost: readInput(p, c.totalCost), area: readInput(p, c.occupiedArea), scenarioId: s.id, capacity: { text: '0.5', source: 'Uji sintetis', evidence: 'ASSUMPTION' }, reuse: null });
  qualifyScientificFixture(p);
  const reviewed = p.components.find(v => v.id === c.id)!;
  expect(reviewed.performanceByScenario[s.id]?.reviewedRainfallMm).toBe(50);
  expect(interventionReview(p, [reviewed], s.id).filter(n => n.kind === 'rain')).toHaveLength(0);
  p = saveRain(p, s.id, s.name, { text: '100', source: 'Skenario uji', evidence: 'ASSUMPTION' }, 'Uji kejadian');
  expect(interventionReview(p, [reviewed], s.id).find(n => n.kind === 'rain')?.message).toContain('Konteks hujan/durasi');
  const performance = reviewed.performanceByScenario[s.id]!;
  expect('infiltrationCapacity' in performance && readInput(p, performance.infiltrationCapacity, s.id).text).toBe('0.5');
});
