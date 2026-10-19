import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {alternativeSearch} from '../src/direction/productionBridge';
import type {ProjectV2} from '../src/domain/projectV2';
const folder=process.env.TIRTA_DENSITY_EVIDENCE??'evidence/uiux-candidate/search-warning-density';
async function navigate(page:Page,name:string) {
 const button=page.locator('.app-rail nav').getByRole('button',{name:name==='Alternatif'?'Bandingkan':name,exact:true,includeHidden:true});
 for(const d of await button.locator('xpath=ancestor::details').all())await d.evaluate(el=>(el as HTMLDetailsElement).open=true);
 await button.focus();await page.keyboard.press('Enter');
}
async function importProject(page:Page,p:ProjectV2) {
 await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan').setInputFiles({name:'warning-density.tirta.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'tirta-project',formatVersion:1,project:p}))});
 await expect(page.locator('.view-studio')).toBeVisible();
 const close=page.getByRole('button',{name:'Tutup pemberitahuan'});if(await close.isVisible())await close.click();
 await navigate(page,'Alternatif');await expect(page.locator('.view-alternatives')).toBeVisible();
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const messages:string[]=[];errors.set(page,messages);page.on('pageerror',e=>messages.push(e.message));page.on('console',m=>{if(m.type()==='error')messages.push(m.text());});});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));

for(const width of [1920,1366,390])test(`large rejected package sets never become a wall of text; every candidate remains inspectable at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:768});
 const {project:p}=JSON.parse(await readFile('evidence/uiux-candidate/treatment/declared-four-family-demo.tirta.json','utf8')) as {project:ProjectV2};
 for(let i=0;i<3;i++) {
  const component=structuredClone(p.components.find(c=>c.family==='infiltration')!);component.id=`density-soak-${i}`;component.name=`Biopori ${i+1} — lokasi tanah dan bukti kinerja yang masih harus diperiksa dengan catatan sangat panjang`;p.components.push(component);
  p.optionGroups.push({id:`density-choice-${i}`,name:component.name,enabled:true,choices:[{id:'off',name:'Tidak dipakai',enabled:true,componentIds:[]},{id:'on',name:component.name,enabled:true,componentIds:[component.id]}]});
 }
 for(const c of p.components){c.enabled=true;if(c.id==='tank')continue;for(const perf of Object.values(c.performanceByScenario)){const ref='availableStorage' in perf?perf.availableStorage:'infiltrationCapacity' in perf?perf.infiltrationCapacity:perf.additionalInfiltrationCapacity;const v=p.parameters.find(v=>v.id===ref.id)!;v.value=null;v.evidence='UNKNOWN';v.source='';ref.evidence='UNKNOWN';}}
 for(const group of p.optionGroups)group.enabled=true;
 if(p.science){p.science.interventions={};p.science.connections=[];}
 p.selectedPlan=null;
 const canonical=alternativeSearch(p,p.scenarios[0]!.id);
 const visibleRows=canonical.rows.filter(row=>row.plan.components.some(component=>component.enabled));
 expect(visibleRows.length).toBeGreaterThan(0);
 const excludedCount=canonical.excluded.length;expect(excludedCount).toBeGreaterThan(63);expect(visibleRows).toHaveLength(1);expect(canonical.rows.some(row=>!row.plan.components.some(component=>component.enabled))).toBe(true);expect(canonical.excluded.reduce((n,row)=>n+row.reasons.join(' ').length,0)).toBeGreaterThan(4000);
 await importProject(page,p);
 await expect(page.locator('.view-alternatives > .feasibility-note.invalid')).toHaveCount(0);
 await expect(page.locator('.compare-candidate input')).toHaveCount(visibleRows.length);
 const trigger=page.getByRole('button',{name:`${excludedCount} paket tersisih · Lihat alasan`,exact:true});await expect(trigger).toBeVisible();
 expect((await trigger.boundingBox())!.height).toBeLessThan(100);
 expect((await page.locator('.comparison-workbench').boundingBox())!.y).toBeLessThan(width===390?600:320);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/alternatives-${width}.png`,fullPage:true});
 await trigger.click();const dialog=page.getByRole('dialog',{name:'Dasar pencarian & pilihan tersisih',exact:true});
 await expect(dialog.getByLabel('Paket tersisih',{exact:true}).locator('option')).toHaveCount(excludedCount);
 await expect(dialog.getByRole('region',{name:'Alasan paket tersisih'})).toHaveCount(1);
 await dialog.getByLabel('Paket tersisih',{exact:true}).selectOption(`excluded-${excludedCount-1}`);
 const last=canonical.excluded.at(-1)!;await expect(dialog.getByRole('region',{name:'Alasan paket tersisih'})).toContainText(last.plan.name);
 for(const reason of new Set(last.reasons))await expect(dialog.getByRole('region',{name:'Alasan paket tersisih'})).toContainText(reason);
 await dialog.getByLabel('Cari paket atau alasan').fill('nama yang tidak ada sama sekali');await expect(dialog).toContainText('Tidak ada paket atau alasan yang cocok.');
 await dialog.getByLabel('Cari paket atau alasan').fill('Biopori 2');expect(await dialog.getByLabel('Paket tersisih',{exact:true}).locator('option').count()).toBeGreaterThan(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const accessibility=await new AxeBuilder({page}).include('dialog').analyze();
 // This untouched 11px helper has a pre-existing 4.17:1 contrast ratio. Keep the
 // protected visual design and record this exact baseline finding; reject any
 // other violation rather than disabling the contrast rule.
 await writeFile(`${folder}/accessibility-${width}.json`,JSON.stringify(accessibility.violations,null,2));
 const knownContrast=(v:typeof accessibility.violations[number])=>v.id==='color-contrast'&&v.nodes.every(n=>JSON.stringify(n.target)===JSON.stringify(['.search-exclusion-browser > .quiet'])&&n.any.some(a=>a.data?.contrastRatio===4.17));
 expect(accessibility.violations.filter(v=>!knownContrast(v))).toEqual([]);
 await page.screenshot({path:`${folder}/detail-${width}.png`});
 await dialog.getByRole('button',{name:'Tutup',exact:true}).focus();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 await navigate(page,'Bandingkan');await expect(page.locator('.view-alternatives .comparison-workbench')).toBeVisible();await expect(page.locator('.view-alternatives > .feasibility-note.invalid')).toHaveCount(0);
 await page.screenshot({path:`${folder}/compare-${width}.png`,fullPage:true});
});
