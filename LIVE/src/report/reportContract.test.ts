import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { legacyPlanningFingerprint, planningFingerprint, snapshotPlan } from '../domain/planningEngine';
import { migrateProject } from '../domain/migration';
import { buildProjectReport } from './projectReport';
import { reportHtml } from './reportHtml';
import { reportPdfDefinition } from './reportPdf';

describe('frozen report identity compatibility', () => {
  it('prints the pre-task identity while validating the migrated choice with the decision identity', () => {
    const input = demoProject(true);
    input.selectedPlan = {
      definition: snapshotPlan(input, ['tank'], 'saved-report-plan', 'Tangki atap'),
      decisionNote: 'Pilihan pengguna',
      reviewedInputFingerprint: legacyPlanningFingerprint(input),
    };
    const project = migrateProject(input, input.updatedAt);
    const before = structuredClone(project);
    expect(project.selectedPlan!.reviewedInputFingerprint).toBe(planningFingerprint(project));
    expect(planningFingerprint(project)).not.toBe(legacyPlanningFingerprint(project));
    const report = buildProjectReport(project, 'r50', { detail: 'detailed' });
    expect(report.state).toBe('selected');
    expect(report.metrics).not.toBeNull();
    expect(report.inputFingerprint).toBe(legacyPlanningFingerprint(project));
    expect(reportHtml(report)).toContain(`Identitas input: ${report.inputFingerprint}`);
    expect(JSON.stringify(reportPdfDefinition(report))).toContain(`Identitas input: ${report.inputFingerprint}`);
    expect(project).toEqual(before);

    project.science!.interventions.tank!.maintenance += ' Catatan verifikasi.';
    expect(planningFingerprint(project)).toBe(project.selectedPlan!.reviewedInputFingerprint);
    expect(buildProjectReport(project, 'r50').state).toBe('selected');
    project.parameters.find(parameter => parameter.id === project.scenarios[0]!.rainfall.id)!.value! += 1;
    expect(buildProjectReport(project, 'r50').state).toBe('stale');
    expect(buildProjectReport(project, 'r50').metrics).toBeNull();
  });
});
