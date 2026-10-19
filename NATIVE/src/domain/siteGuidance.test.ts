import { describe, expect, it } from 'vitest';
import { demoProject } from '../direction/productionBridge';
import { emptySurfaceContext, unknownNumber } from './scientificContract';
import { siteGuidance } from './siteGuidance';
import { productionBaseline } from './productionBaseline';
import { recordFieldObservation } from './fieldObservations';

const guide = (p: ReturnType<typeof demoProject>, id: string, options: Parameters<typeof siteGuidance>[2] = {}) => siteGuidance(p, 'r50', options).find(x => x.id === id)!;
describe('site-specific deterministic decision support', () => {
  it('uses a ponding observation as context without concealing unsuitable groundwater or changing eligibility', () => {
    const p = recordFieldObservation(demoProject(), 'z2', { condition: 'ponding', note: '' });
    p.science!.interventions.soak!.groundwaterAssessment = 'unsuitable';
    const g = guide(p, 'infiltration', { componentId: 'soak' });
    expect(g.status).toBe('conflict'); expect(g.reason).toContain('Air sering tertahan');
    expect(g.reason).toContain('air tanah'); expect(g.nextAction.field).toBe('groundwater');
    expect(g.conditions.some(v => v.includes('dari area mana'))).toBe(true);
  });
  it('observed concentrated flow prompts actual source confirmation and never creates a route', () => {
    const p = recordFieldObservation(demoProject(), 'z0', { condition: 'concentrated-runoff', note: '' }), before = structuredClone(p);
    const g = guide(p, 'storage', { sourceZoneIds: ['z0'] });
    expect(g.reason).toContain('Aliran terkumpul'); expect(g.nextAction.field).toBe('connection');
    expect(g.eventReady).toBe(false); expect(p).toEqual(before);
  });
  it('does not fabricate capacity or mutate project when a teacher has an unknown roof outlet', () => {
    const p = demoProject(), before = structuredClone(p);
    const g = guide(p, 'storage', { sourceZoneIds: ['z0'] });
    expect(g.status).toBe('needs-data'); expect(g.nextAction.field).toBe('connection');
    expect(p).toEqual(before);
  });
  it('recognizes controlled roof collection and asks for configuration rather than a hidden best answer', () => {
    const p = demoProject(), ctx = emptySurfaceContext(); ctx.roof.outlet = 'gutter-downpipe'; p.science!.surfaces.z0 = ctx;
    const g = guide(p, 'storage', { sourceZoneIds: ['z0'] });
    expect(g.status).toBe('eligible'); expect(g.eventReady).toBe(false);
    expect(g.nextAction.field).toBe('capacity');
  });
  it('makes slope consequential through area/catchment review, without changing event volume', () => {
    const p = demoProject(), ctx = emptySurfaceContext(); ctx.roof.outlet = 'gutter-downpipe'; ctx.roof.form = 'sloped';
    ctx.roof.pitch = { value: 35, unit: 'degrees', origin: 'user_supplied', source: 'Synthetic slope', method: '', date: '' }; p.science!.surfaces.z0 = ctx;
    const before = productionBaseline(p, 'r50');
    const g = guide(p, 'storage', { sourceZoneIds: ['z0'] });
    expect(g.status).toBe('needs-data'); expect(g.nextAction.field).toBe('catchment');
    ctx.roof.pitch.value = 0; expect(productionBaseline(p, 'r50')).toEqual(before);
  });
  it('one whole roof with reviewed connection remains calculatable even if its outlet context was not repeated', () => {
    const p = demoProject();
    expect(guide(p, 'storage', { componentId: 'tank' }).eventReady).toBe(true);
  });
  it('dispersed edges need a collection review rather than universally forbidding tanks', () => {
    const p = demoProject(), ctx = emptySurfaceContext(); ctx.roof.outlet = 'edge'; p.science!.surfaces.z0 = ctx;
    expect(guide(p, 'storage', { sourceZoneIds: ['z0'] }).status).toBe('needs-data');
  });
  it('open soil alone does not establish infiltration capacity', () => {
    const p = demoProject();
    const g = guide(p, 'infiltration', { sourceZoneIds: ['z1'], installationZoneId: 'z2' });
    expect(g.status).toBe('needs-data'); expect(g.nextAction.field).toBe('soil');
  });
  it('known zero infiltration conflicts instead of returning an invented benefit', () => {
    const p = demoProject(); p.science!.interventions.soak!.soilInfiltration.value = 0;
    expect(guide(p, 'infiltration', { componentId: 'soak' }).status).toBe('conflict');
  });
  it('known unsuitable groundwater withdraws modeled infiltration while storage remains available', () => {
    const p = demoProject(); p.science!.interventions.soak!.groundwaterAssessment = 'unsuitable';
    expect(guide(p, 'infiltration', { componentId: 'soak' }).status).toBe('conflict');
    expect(guide(p, 'storage', { componentId: 'tank' }).eventReady).toBe(true);
  });
  it('groundwater depth alone is not a universal site threshold', () => {
    const p = demoProject(); const e = p.science!.interventions.soak!; e.groundwaterAssessment = 'unknown'; e.groundwaterBasis = ''; e.groundwaterDepth = { value: .1, unit: 'm', origin: 'user_supplied', source: 'Declared depth', method: '', date: '' };
    const g = guide(p, 'infiltration', { componentId: 'soak' }); expect(g.status).toBe('eligible');expect(g.eventReady).toBe(true);expect(g.conditions.join(' ')).toContain('air tanah');
  });
  it('compaction changes next guidance, not a guessed soil-capacity number', () => {
    const p = demoProject(), ctx = emptySurfaceContext(); ctx.soil.compaction = 'compacted'; p.science!.surfaces.z2 = ctx;
    expect(guide(p, 'infiltration', { installationZoneId: 'z2' }).reason).toContain('padat');
  });
  it('clogged existing porous surface does not retire a new paved conversion elsewhere', () => {
    const p = demoProject(), ctx = emptySurfaceContext(); ctx.porous.clogging = 'observed'; p.science!.surfaces.z4 = ctx;
    const g = guide(p, 'infiltration', { sourceZoneIds: ['z4'] }); expect(g.nextAction.field).toBe('surface-condition');
    const conversion=guide(p,'permeable',{sourceZoneIds:['z1']});expect(conversion.status).toBe('eligible');expect(conversion.nextAction.field).toBe('capacity');
  });
  it('unknown storage asks capacity and known zero remains a valid zero-benefit event', () => {
    const p = demoProject(), c = p.components[0]!; if (c.family !== 'storage') throw new Error('fixture');
    const v = p.parameters.find(x => x.id === c.performanceByScenario.r50!.availableStorage.id)!; v.value = null; v.evidence = 'UNKNOWN'; c.performanceByScenario.r50!.availableStorage.evidence = 'UNKNOWN';
    expect(guide(p, 'storage', { componentId: 'tank' }).nextAction.field).toBe('capacity');
    v.value = 0; v.evidence = 'DEMO'; c.performanceByScenario.r50!.availableStorage.evidence = 'DEMO';
    expect(guide(p, 'storage', { componentId: 'tank' }).eventReady).toBe(true);
  });
  it('changed duration requests performance review instead of integrating a raw soil rate', () => {
    const p = demoProject(); p.science!.rainfall.r50 = { value: 120, unit: 'minutes', origin: 'user_supplied', source: 'Declared duration', method: '', date: '' };
    expect(guide(p, 'infiltration', { componentId: 'soak' }).nextAction.field).toBe('capacity');
  });
  it('missing money is a comparison question, without poisoning an otherwise supported water calculation', () => {
    const p = demoProject(); const v = p.parameters.find(x => x.id === p.constraints.budget.id)!; v.value = null; v.evidence = 'UNKNOWN'; p.constraints.budget.evidence = 'UNKNOWN';
    expect(guide(p, 'storage', { componentId: 'tank' }).eventReady).toBe(true);
    const g = guide(p, 'storage', { componentId: 'tank', includeResources: true }); expect(g.status).toBe('needs-data'); expect(g.nextAction.field).toBe('resources');
  });
  it('a Biopori receiver permits all non-roof surfaces without inferring site evidence', () => {
    const p = demoProject();
    expect(guide(p, 'biopori', { installationZoneId: 'z0' }).status).toBe('conflict');
    for (const installationZoneId of ['z1', 'z2', 'z3', 'z4']) {
      const result = guide(p, 'biopori', { sourceZoneIds: ['z0'], installationZoneId });
      expect(result.status).not.toBe('conflict');
      expect(result.status).toBe('needs-data');
      expect(result.eventReady).toBe(false);
    }
  });
  it('blocks known damaged installations but models declared capacity with unknown soil conditions', () => {
    const p = demoProject(); p.science!.interventions.soak!.condition = 'damaged';
    expect(guide(p, 'infiltration', { componentId: 'soak' }).nextAction.field).toBe('maintenance');
    p.science!.interventions.soak!.condition = 'maintained'; p.science!.interventions.soak!.soilInfiltration = unknownNumber('mm/h');
    expect(guide(p, 'infiltration', { componentId: 'soak' }).eventReady).toBe(true);
    expect(guide(p,'infiltration',{componentId:'soak'}).conditions.join(' ')).toContain('infiltrasi tanah');
  });
});
