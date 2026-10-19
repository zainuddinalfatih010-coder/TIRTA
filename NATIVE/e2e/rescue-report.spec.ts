import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {demoProject,setActiveComponents,alternativeSearch} from '../src/direction/productionBridge';
import {snapshotPlan,planningFingerprint} from '../src/domain/planningEngine';
import {buildProjectReport,number} from '../src/report/projectReport';
import type {ProjectV2} from '../src/domain/projectV2';

const out=process.env.TIRTA_REPORT_FINISH_DIR ?? 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/report-finish';
type Options=Parameters<typeof buildProjectReport>[2];
function tankChosen(){const p=setActiveComponents(demoProject(true),['tank','soak','garden']);p.selectedPlan={definition:snapshotPlan(p,['tank'],'report-tank','Tangki pilihan'),decisionNote:'Talang berada dekat lokasi tangki.',reviewedInputFingerprint:planningFingerprint(p)};return p;}
async function open(page:Page,p:ProjectV2){await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'qa.tirta.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'tirta-project',formatVersion:1,project:p}))});await expect(page.locator('.view-studio')).toBeVisible();await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Laporan proyek',exact:true}).click();await expect(page.getByRole('dialog',{name:'Bagikan hasil'})).toBeVisible();}
async function html(page:Page){const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Laporan HTML',exact:true}).click()]);return readFile((await download.path())!,'utf8');}
async function pdf(page:Page,name:string,p:ProjectV2,options:Options={}){
  const expected=buildProjectReport(p,'r50',options);
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Unduh PDF',exact:true}).click()]);
  await download.saveAs(out+'/'+name+'.pdf');expect((await readFile((await download.path())!)).subarray(0,5).toString()).toBe('%PDF-');
  await writeFile(out+'/'+name+'-expected.json',JSON.stringify({metrics:expected.metrics,state:expected.state,sections:expected.sections.map(s=>s.id),mode:expected.detail,sources:expected.includeSources},null,2));
}
test.beforeEach(async({page})=>{await mkdir(out,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});(page as Page & {reportErrors:string[]}).reportErrors=errors;});
test.afterEach(async({page},info)=>{const errors=(page as Page & {reportErrors:string[]}).reportErrors;await writeFile(out+'/'+info.title.replace(/[^a-z0-9]/gi,'-')+'-errors.json',JSON.stringify(errors));expect(errors).toEqual([]);});

test('report default summary, source switch, scoped packages and one comparator remain independent',async({page})=>{
 const p=tankChosen();await open(page,p);
 await expect(page.getByRole('button',{name:'Ringkasan',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('switch',{name:'Sumber laporan'})).not.toBeChecked();
 await expect(page.getByLabel('Alternatif pembanding',{exact:true})).toHaveValue('');
 const before=await page.locator('.report-result').innerText();expect(before).toContain('3,72');
 await expect(page.locator('.tirta-report')).toContainText('Talang berada dekat lokasi tangki.');
 await pdf(page,'tank-summary-off',p);const without=await html(page);expect(without).not.toContain('user_supplied');expect(without).not.toContain('event-ledger');expect(without).toContain('luapan');
 await page.getByRole('switch',{name:'Sumber laporan'}).check();expect(await page.locator('.report-result').innerText()).toBe(before);await pdf(page,'tank-summary-on',p,{includeSources:true});
 await page.getByRole('button',{name:'Laporan rinci',exact:true}).click();await expect(page.getByRole('switch',{name:'Sumber laporan'})).toBeChecked();await pdf(page,'tank-detailed-on',p,{detail:'detailed',includeSources:true});
 await page.getByRole('switch',{name:'Sumber laporan'}).uncheck();await pdf(page,'tank-detailed-off',p,{detail:'detailed'});
 await page.getByRole('button',{name:'Ringkasan',exact:true}).click();await expect(page.getByRole('switch',{name:'Sumber laporan'})).not.toBeChecked();
 await page.getByLabel('Paket dalam laporan',{exact:true}).selectOption('active');expect(await html(page)).not.toContain('Talang berada dekat lokasi tangki.');await pdf(page,'three-active',p,{planScope:'active'});
 const [backup]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);const imported=(JSON.parse(await readFile((await backup.path())!,'utf8')) as {project:ProjectV2}).project;
 const rows=alternativeSearch(imported,'r50').rows;expect(rows.every(r=>!r.plan.components.some(c=>c.enabled&&c.family==='permeable'))).toBe(true);const alt=rows.find(r=>r.optionIds.includes('garden'))!;
 await page.getByLabel('Paket dalam laporan',{exact:true}).selectOption('alternative:'+alt.id);await expect(page.locator('.report-result')).toContainText(number(alt.balance.residual));expect(await html(page)).not.toContain('Talang berada dekat lokasi tangki.');
 const comparator=rows.find(r=>!r.optionIds.length)!;await page.getByLabel('Alternatif pembanding',{exact:true}).selectOption(comparator.id);
 const compared=await html(page);expect((compared.match(/id="comparison"/g)||[]).length).toBe(1);
 await pdf(page,'one-alternative-comparator',imported,{planScope:'alternative',planId:alt.id,comparisonPlanId:comparator.id});
 await page.getByLabel('Paket dalam laporan',{exact:true}).selectOption('selected');await expect(page.locator('.tirta-report')).toContainText('Talang berada dekat lokasi tangki.');await page.screenshot({path:out+'/dialog-desktop.png'});
});

test('actual report controls are usable and accessible at nearby desktop and mobile widths',async({page})=>{
 await open(page,tankChosen());
 for(const [width,height] of [[1920,1080],[1440,900],[1366,650],[1280,800],[768,1024],[390,844],[360,740],[320,740]] as const){
  await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const name of ['Unduh PDF','Cadangan proyek','Laporan HTML'])await expect(page.getByRole('button',{name,exact:true})).toBeInViewport();
  for(const name of ['Paket dalam laporan','Alternatif pembanding'])await expect(page.getByLabel(name,{exact:true})).toBeInViewport();
  expect((await new AxeBuilder({page}).include('.project-report-dialog').analyze()).violations).toEqual([]);
  await page.screenshot({path:out+'/dialog-'+width+'.png'});
  if(width===390){await page.locator('.report-preview-layout > .tirta-report').evaluate(el=>el.scrollTop=260);await page.screenshot({path:out+'/dialog-mobile-result.png'});}
 }
});

test('valid synthetic soil Biopori remains represented in selected package and source-free PDF',async({page})=>{
 const p=(JSON.parse(await readFile('E:/CodexStore/home/audits/tirta-rescue-2026-10-07/report/biopori-fixture.tirta.json','utf8')) as {project:ProjectV2}).project;
 await open(page,p);await expect(page.locator('.tirta-report')).toContainText('Biopori QA');await expect(page.locator('.report-result')).toContainText('6,22');await pdf(page,'biopori-summary',p);expect(await html(page)).toContain('Biopori QA');
 await page.getByRole('button',{name:'Laporan rinci',exact:true}).click();await page.getByRole('switch',{name:'Sumber laporan'}).check();await pdf(page,'biopori-detail-sources',p,{detail:'detailed',includeSources:true});
});

test('an imported manual package named active never falls back to the active draft scope',async({page})=>{
 const p=tankChosen();p.manualPlans.push(snapshotPlan(p,[],'active','Paket manual tanpa penanganan'));p.selectedPlan!.reviewedInputFingerprint=planningFingerprint(p);
 await open(page,p);await page.getByLabel('Paket dalam laporan',{exact:true}).selectOption('alternative:active');
 await expect(page.locator('.report-result')).toContainText('6,27 → 6,27');expect(await html(page)).toContain('Alternatif yang ditinjau adalah tanpa intervensi');
 await pdf(page,'manual-reserved-name',p,{planScope:'alternative',planId:'active'});
});

test('UNKNOWN secondary scenario, stale choice, long names and dense draft export honest states',async({page})=>{
 const partial=tankChosen();delete partial.selectedPlan!.definition.components[0]!.performanceByScenario.r100;await open(page,partial);expect(await html(page)).toContain('Belum dapat dinilai');await pdf(page,'unknown-secondary',partial);await page.keyboard.press('Escape');
 const stale=tankChosen();stale.selectedPlan!.reviewedInputFingerprint='older-input';await open(page,stale);
 // Imported stale inputs remain withheld rather than treating missing results as zero.
 await expect(page.locator('.report-result')).toHaveCount(0);expect(await html(page)).toContain('belum ditinjau ulang');await pdf(page,'stale-selected',stale);await page.keyboard.press('Escape');
 const long=tankChosen();long.name='Sekolah pengujian laporan dengan nama bangunan pendidikan yang panjang untuk pemeriksaan keterbacaan';long.zones[0]!.name='Atap bangunan pendidikan sisi timur dengan nama lengkap yang tetap harus dapat dibaca dalam setiap laporan';long.selectedPlan!.definition.components[0]!.name='Tangki bangunan pendidikan sisi timur untuk pengujian nama lengkap yang tidak dipotong';long.selectedPlan!.reviewedInputFingerprint=planningFingerprint(long);await open(page,long);await pdf(page,'long-names',long);expect(await html(page)).toContain(long.zones[0]!.name);await page.keyboard.press('Escape');
 const dense=(JSON.parse(await readFile('evidence/uiux-candidate/fixtures/density-known.tirta.json','utf8')) as {project:ProjectV2}).project;await open(page,dense);await expect(page.locator('.report-result')).toHaveCount(0);await pdf(page,'dense-incomplete',dense);expect(await html(page)).toContain('Belum diketahui');
});
