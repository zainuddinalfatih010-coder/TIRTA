import {describe,it,expect} from 'vitest';
import {demoProject} from '../direction/productionBridge';
import {saveRain} from './planningAuthoring';
const input=(text:string)=>({text,source:'Explicit software test rainfall, not local measurement',evidence:'DEMO' as const});
describe('rain labels follow explicit example edits without renaming a personal scenario',()=>{
  it('renames the example depth, including decimal Indonesian display',()=>{
    let p=saveRain(demoProject(),'r50','Hujan uji 50 mm',input('50'),'Test');
    p=saveRain(p,'r50','Hujan uji 50 mm',input('75.5'),'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan uji 75,5 mm');
    p=saveRain(p,'r50','Hujan uji 75,5 mm',input('25'),'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan uji 25 mm');
  });
  it('preserves a personal label after depth changes',()=>{
    let p=saveRain(demoProject(),'r50','Hujan acara sekolah',input('50'),'Test');
    p=saveRain(p,'r50','Hujan acara sekolah',input('75'),'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan acara sekolah');
  });
  it('clears an automatic depth label when rain becomes unknown and resumes it for explicit zero',()=>{
    let p=saveRain(demoProject(),'r50','Hujan uji 50 mm',input('50'),'Test');
    p=saveRain(p,'r50',p.scenarios[0]!.name,{text:'',source:'',evidence:'UNKNOWN'},'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan uji belum diisi');
    p=saveRain(p,'r50',p.scenarios[0]!.name,input('0'),'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan uji 0 mm');
    p=saveRain(p,'r50',p.scenarios[0]!.name,input('70'),'Test');
    expect(p.scenarios[0]!.name).toBe('Hujan uji 70 mm');
  });
  it('keeps a personal label through an unknown value and explicit zero',()=>{
    let p=saveRain(demoProject(),'r50','Pengujian halaman sekolah',input('50'),'Test');
    p=saveRain(p,'r50',p.scenarios[0]!.name,{text:'',source:'',evidence:'UNKNOWN'},'Test');
    p=saveRain(p,'r50',p.scenarios[0]!.name,input('0'),'Test');
    expect(p.scenarios[0]!.name).toBe('Pengujian halaman sekolah');
  });
});
