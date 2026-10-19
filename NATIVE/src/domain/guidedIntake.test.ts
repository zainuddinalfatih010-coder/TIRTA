import { describe,it,expect } from 'vitest';
import { intakeQuestions,questionQueue } from './guidedIntake';
import { treatmentRequirements } from './productState';
import { exploreTreatment } from './treatmentEditing';
import { demoProject,setActiveComponents } from '../direction/productionBridge';
import { planningFingerprint } from './planningEngine';
describe('guided knowledge inventory is presentation, not science',()=>{
  for(const [family,bio] of [['storage',false],['infiltration',false],['infiltration',true],['rain-garden',false]] as const)it(`${family}/${bio} adapts intake and keeps canonical input untouched`,()=>{
    const edit=exploreTreatment(setActiveComponents(demoProject(),[]),family,'r50',undefined,bio);
    const beforeEditEnabled=edit.project.components.find(c=>c.id===edit.id)!.enabled;
    const before=planningFingerprint(edit.project),c=edit.project.components.find(c=>c.id===edit.id)!;
    const sections=treatmentRequirements(edit.project,c,'r50');
    const intake=intakeQuestions(sections);
    expect(intake.length).toBeLessThanOrEqual(5);
    expect(intake.some(q=>q.id==='site')).toBe(false);
    const queue=questionQueue(sections,{connection:'unknown',capacity:'unknown',site:'unknown',cost:'yes'});
    expect(queue).toContain('source');expect(queue).toContain('capacity');expect(queue).not.toContain('soil');expect(queue).not.toContain('groundwater');
    questionQueue(sections,{connection:'yes',capacity:'yes',site:'yes'});
    expect(planningFingerprint(edit.project)).toBe(before);
    expect(edit.project.components.find(c=>c.id===edit.id)!.enabled).toBe(beforeEditEnabled);
  });
  it('does not reask known project limits or known tank science',()=>{
    const p=setActiveComponents(demoProject(),['tank']);const sections=treatmentRequirements(p,p.components.find(c=>c.id==='tank')!,'r50');
    expect(intakeQuestions(sections).some(q=>['cost','area','capacity'].includes(q.id))).toBe(false);
    const queue=questionQueue(sections,{});expect(queue).not.toContain('budget');expect(queue).not.toContain('cost');expect(queue).not.toContain('capacity');
  });
  it('all missing facts remain on map after unknown deferral, while the queue moves on',()=>{
    const edit=exploreTreatment(demoProject(),'infiltration','r50',undefined,true),c=edit.project.components.find(c=>c.id===edit.id)!;
    const sections=treatmentRequirements(edit.project,c,'r50');
    const queue=questionQueue(sections,{},['source','installation']);expect(queue).not.toContain('source');
    expect(sections.flatMap(s=>s.rows).find(r=>r.field==='source')!.status).toBe('missing');
  });
  it('conflicts take priority over optional site notes or known preferences',()=>{
    const edit=exploreTreatment(demoProject(),'infiltration','r50',undefined,true);const c=edit.project.components.find(c=>c.id===edit.id)!;
    c.treatment!.installationZoneId='z0';const sections=treatmentRequirements(edit.project,c,'r50');
    expect(questionQueue(sections,{connection:'unknown',capacity:'unknown',site:'unknown',cost:'yes'})[0]).toBe('installation');
  });
  it('optional advisory rows never enter the required guided queue',()=>{
    const p=setActiveComponents(demoProject(),['tank']),c=p.components.find(c=>c.id==='tank')!;
    const sections=treatmentRequirements(p,c,'r50'),rows=sections.flatMap(s=>s.rows);
    for(const field of ['connection','condition','maintenance','field','operation']) {
      const row=rows.find(r=>r.field===field)!;
      expect((row as typeof row & {required?:boolean}).required).toBe(false);
      expect(questionQueue(sections,{})).not.toContain(field);
    }
  });
});

