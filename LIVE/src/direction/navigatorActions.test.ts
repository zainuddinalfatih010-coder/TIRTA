import {describe,it,expect} from 'vitest';
import {answerOrientation,navigatorToolAction,navigatorProjectFacts} from './navigatorActions';
import {newNavigatorJourney,reconcileJourney} from '../domain/navigatorJourney';
import {demoProject,blankSnapshot} from './productionBridge';
import {navigatorFactId} from '../domain/navigatorFacts';
describe('registered Navigator actions',()=>{
 it('orientation changes only journey, not scientific project data',()=>{const p=demoProject(),before=JSON.stringify(p),j=answerOrientation(newNavigatorJourney(p.id),'knowledge',{knowledge:{capacity:'yes'}});expect(j.knowledge.capacity).toBe('yes');expect(JSON.stringify(p)).toBe(before);});
 it('geometry task returns a Studio focus action instead of a fabricated number',()=>{const p=blankSnapshot().project,f=navigatorProjectFacts(p,'r50').find(x=>x.key==='geometry')!;expect(navigatorToolAction(f)).toMatchObject({destination:'studio',field:'geometry'});});
 it('an unregistered action cannot execute',()=>{expect(()=>navigatorToolAction({id:'raw:inject',key:'inject'} as never)).toThrow();});
 it('upstream edits recompute the current task and retain independent journey answers',()=>{const p=demoProject(),j={...newNavigatorJourney(p.id),knowledge:{cost:'yes' as const},currentTaskId:'obsolete'};p.zones[0]!.coefficient.evidence='UNKNOWN';Object.assign(p.parameters.find(x=>x.id===p.zones[0]!.coefficient.id)!,{value:null,evidence:'UNKNOWN',source:''});const n=reconcileJourney(p,j,navigatorProjectFacts(p,'r50'));expect(n.currentTaskId).not.toBe('obsolete');expect(n.knowledge.cost).toBe('yes');expect(navigatorProjectFacts(p,'r50').find(x=>x.id===navigatorFactId('zone',p.zones[0]!.id,'r50','coefficient'))?.status).toBe('unknown');});
 it('missing baseline stays earlier than intervention questions with no inherited source',()=>{const p=blankSnapshot().project,f=navigatorProjectFacts(p,'r50');expect(f.some(x=>x.key==='geometry'&&x.blockingOutput==='baseline')).toBe(true);expect(p.components.every(c=>!c.enabled)).toBe(true);});
});

// Roof routing remains one contextual Studio task; never a baseline input.
it('offers roof spatial facts only for relevant intent and leaves baseline values unchanged',()=>{const p=demoProject();const unrelated=navigatorProjectFacts(p,'r50',undefined,'explore');const roof=navigatorProjectFacts(p,'r50',undefined,'roof-runoff').filter(f=>f.key.startsWith('roof'));expect(roof).toHaveLength(8);expect(roof.every(f=>f.blockingOutput==='water'&&f.destination==='studio')).toBe(true);expect(roof.find(f=>f.key==='roofPitch')?.optional).toBe(true);expect(unrelated.filter(f=>f.key.startsWith('roof')).length).toBeLessThanOrEqual(roof.length);});
