import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { productionBaseline } from './productionBaseline';
import { migrateProject } from './migration';
import type { ProjectV2 } from './projectV2';
const path = 'docs/scientific-revision/baseline-fixture.json';
test('scientific revision preserves frozen event-volume baseline fixtures', () => {
  const frozen = JSON.parse(readFileSync(path, 'utf8')) as { project: ProjectV2; results: ReturnType<typeof productionBaseline>[] };
  const project = migrateProject(frozen.project, '2026-10-03T00:00:00.000Z');
  expect(project.parameters).toEqual(frozen.project.parameters);
  expect(project.scenarios.map(s => productionBaseline(project, s.id))).toEqual(frozen.results);
  for (const result of frozen.results) {
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.runoffM3 + result.value.nonRunoffM3).toBeCloseTo(result.value.rainfallM3, 12);
  }
});
