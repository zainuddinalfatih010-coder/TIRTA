import type { RequirementSection, RequirementGroup } from './productState';
import type { ProjectV2 } from './projectV2';
import { productionBaseline } from './productionBaseline';
export type Knowledge = 'yes' | 'partly' | 'unknown';
export type IntakeAnswers = Partial<Record<RequirementGroup | 'cost' | 'area', Knowledge>>;
export type IntakeQuestion = { id: keyof IntakeAnswers; title: string };
export function sourceRunoffFact(project:ProjectV2, scenario:string, targets:string[]):number|null {
  const baseline=productionBaseline(project,scenario);
  if(!baseline.ok||!targets.length||targets.some(id=>!baseline.value.zones.some(z=>z.id===id)))return null;
  return baseline.value.zones.filter(z=>targets.includes(z.id)).reduce((sum,z)=>sum+z.runoffM3,0);
}
/** Presentation only. Knowledge inventory never becomes an observation or a number. */
export function intakeQuestions(sections: RequirementSection[]): IntakeQuestion[] {
  const missing = (group: RequirementGroup) => sections.find(s => s.id === group)?.rows.some(r => r.consequence === 'water' && r.status !== 'known');
  const rows = sections.flatMap(s => s.rows);
  return [
    ...(missing('connection') ? [{ id: 'connection' as const, title: 'Sudah tahu asal dan jalur airnya?' }] : []),
    ...(missing('capacity') ? [{ id: 'capacity' as const, title: 'Sudah punya angka kapasitas untuk hujan ini?' }] : []),
    ...(missing('site') ? [{ id: 'site' as const, title: 'Sudah punya hasil pemeriksaan tanah dan air tanah?' }] : []),
    ...(rows.some(r => r.field === 'cost' && r.status !== 'known') ? [{ id: 'cost' as const, title: 'Sudah punya perkiraan biaya penanganan?' }] : []),
    ...(rows.some(r => r.field === 'area' && r.status !== 'known') ? [{ id: 'area' as const, title: 'Sudah tahu luas pemasangannya?' }] : []),
  ];
}
export function questionQueue(sections: RequirementSection[], answers: IntakeAnswers, visited: string[] = []): string[] {
  const rows = sections.flatMap(s => s.rows.map(r => ({ ...r, group: s.id })));
  const score = (r: typeof rows[number]) => {
    const answer = answers[r.field === 'cost' || r.field === 'area' ? r.field : r.group];
    return [r.status==='invalid'?0:1,answer==='yes'?0:answer==='unknown'?2:1,r.consequence==='water'?0:r.consequence==='comparison'?1:2];
  };
  return rows.filter(r => {
    const answer=answers[r.field==='cost'||r.field==='area'?r.field:r.group];
    // Unknown inventory defers evidence/numeric questions. Zone decisions can still
    // be made from the parcel. All deferred facts remain in the requirement map.
    return (r.required||r.status==='invalid')&&r.status!=='known'&&!visited.includes(r.field)&&(answer!=='unknown'||r.status==='invalid'||r.consequence==='water');
  }).sort((a,b) => {const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]!-y[i]!;return 0;}).map(r => r.field);
}

