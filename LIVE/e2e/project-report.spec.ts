import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {demoProject} from '../src/direction/productionBridge';
import {snapshotPlan,planningFingerprint,evaluatePlan} from '../src/domain/planningEngine';
import {buildProjectReport} from '../src/report/projectReport';
import {projectV2Schema,type ProjectV2} from '../src/domain/projectV2';
const folder=process.env.TIRTA_REPORT_LEGACY_DIR ?? 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/report-legacy';
test.beforeEach(async({page})=>{await mkdir(folder,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});(page as Page & {reportErrors:string[]}).reportErrors=errors;});
test.afterEach(async({page})=>expect((page as Page & {reportErrors:string[]}).reportErrors).toEqual([]));
async function openReport(page:Page){if(!await page.locator('.project-actions > summary').isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Laporan proyek',exact:true}).click();await expect(page.getByRole('dialog',{name:/Laporan draf|Laporan alternatif|Rencana pilihan|Rencana lama/})).toBeVisible();}
async function importProject(page:Page,p:ProjectV2,attachmentData?:Record<string,string>){projectV2Schema.parse(p);await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'fixture.tirta.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'tirta-project',formatVersion:attachmentData?2:1,project:p,...(attachmentData?{attachmentData}:{})}))});await expect(page.locator('.view-studio')).toBeVisible({timeout:20000});}
function selected(){const p=demoProject(true);p.name='Sekolah Taman Sari';p.parameters.push({id:'future-survey',revision:1,value:null,unit:'m',evidence:'UNKNOWN',source:'',note:'Belum disurvei',applicability:''});p.selectedPlan={definition:snapshotPlan(p,p.components.filter(c=>c.enabled).map(c=>c.id),'chosen-report','Paket yang saya pilih'),decisionNote:'Saya mempertimbangkan biaya dan kapasitas pada dua kejadian hujan.',reviewedInputFingerprint:planningFingerprint(p)};return p;}

test('unfinished report remains honest, usable and keyboard accessible at short and mobile sizes',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Nama proyek',{exact:true}).fill('Lahan baru belum disurvei');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();await openReport(page);
  await expect(page.locator('.report-scope-status')).toContainText('Draf proyek');await expect(page.locator('.report-result')).toHaveCount(0);
  for(const [width,height] of [[1440,900],[1366,650],[390,844],[320,740]] as const){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('button',{name:/^Unduh PDF/,exact:true})).toBeInViewport();const axe=await new AxeBuilder({page}).include('.project-report-dialog').analyze();expect(axe.violations).toEqual([]);}
  await expect(page.getByRole('button',{name:'Laporan HTML',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:/^Unduh PDF/})).toBeDisabled();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);const backup=JSON.parse(await readFile((await download.path())!,'utf8'));expect(backup.project.name).toBe('Lahan baru belum disurvei');expect(backup.project.scenarios).toHaveLength(2);
  await expect(page.getByRole('button',{name:'Cadangan proyek',exact:true})).toBeEnabled();await page.setViewportSize({width:1440,height:900});await page.locator('.project-report-dialog').getByRole('button',{name:'Tutup',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.project-report-dialog')).toHaveCount(0);await openReport(page);await page.locator('.project-report-dialog').getByRole('button',{name:'Tutup',exact:true}).focus();await page.keyboard.press('Escape');await expect(page.locator('.project-report-dialog')).toHaveCount(0);
});

test('chosen report downloads a real vector PDF and standalone readable HTML containing all evidence',async({page,browser})=>{
  const p=selected();await importProject(page,p);await openReport(page);await page.getByRole('button',{name:'Laporan rinci',exact:true}).click();await page.getByRole('switch',{name:'Sumber laporan'}).check();
  const expected=buildProjectReport(p,'r50',{includeSources:true,detail:'detailed'});expect(JSON.stringify(expected)).toContain('6,27');expect(JSON.stringify(expected)).toContain('0,36');
  await page.screenshot({path:`${folder}/preview-desktop.png`});
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Unduh PDF/,exact:true}).click()]);await download.saveAs(`${folder}/complete.pdf`);
  const pdf=await readFile((await download.path())!);expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.length).toBeGreaterThan(30000);expect(pdf.length).toBeLessThan(2*1024*1024);
  const [htmlFile]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Laporan HTML',exact:true}).click()]);await htmlFile.saveAs(`${folder}/complete.html`);const html=await readFile((await htmlFile.path())!,'utf8');
  expect(html).toContain('Saya mempertimbangkan biaya');expect(html).toContain('Kontribusi terbesar');expect(html).toContain('CLAIM');expect(html).toContain('J-RWH-2017');expect(html).toContain('METHOD-EPA-VOLUME');expect(html).not.toContain('textarea');expect(html).not.toContain('<script');
  // Inspect the downloaded artifact in an isolated offline context, not just its source.
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.setOffline(true);const artifact=await context.newPage();await artifact.setContent(html);expect(await artifact.locator('section').count()).toBe(buildProjectReport(p,'r50',{includeSources:true,detail:'detailed'}).sections.length);expect(await artifact.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const axe=await new AxeBuilder({page:artifact}).analyze();expect(axe.violations).toEqual([]);await artifact.screenshot({path:`${folder}/artifact-mobile.png`});await context.close();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${folder}/preview-mobile.png`});
});

test('source-free is the default and both download choices preserve results and limitations',async({page})=>{
  await importProject(page,selected());await openReport(page);
  await expect(page.getByRole('switch',{name:'Sumber laporan'})).not.toBeChecked();
  const before=await page.getByRole('combobox',{name:'Paket dalam laporan',exact:true}).inputValue();
  const [pdf]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Unduh PDF/,exact:true}).click()]);await pdf.saveAs(`${folder}/without-sources.pdf`);expect(pdf.suggestedFilename()).toContain('tanpa-sumber');
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Laporan HTML',exact:true}).click()]);await file.saveAs(`${folder}/without-sources.html`);const html=await readFile((await file.path())!,'utf8');expect(html).not.toContain('J-RWH-2017');expect(html).not.toContain('Referensi dan relevansi');expect(html).toContain('Tidak memprediksi');expect(html).toContain('belum diketahui');
  await page.getByRole('switch',{name:'Sumber laporan'}).check();expect(await page.getByRole('combobox',{name:'Paket dalam laporan',exact:true}).inputValue()).toBe(before);
  await page.setViewportSize({width:390,height:844});await page.getByRole('switch',{name:'Sumber laporan'}).uncheck();await page.screenshot({path:`${folder}/without-sources-mobile.png`});
});

test('portable transfer restores selected decision, science, UNKNOWN and real underlay bytes into fresh browser storage',async({page,browser})=>{
  const p=selected();const encoded=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=10;canvas.getContext('2d')!.fillRect(0,0,20,10);return canvas.toDataURL('image/png').split(',')[1]!;});const bytes=Buffer.from(encoded,'base64'),hash=createHash('sha256').update(bytes).digest('hex');
  p.attachments=[{id:'underlay',purpose:'underlay',mediaType:'image/png',byteLength:bytes.length,sha256:hash,width:20,height:10,source:'Synthetic transfer image'}];p.underlay={attachmentId:'underlay',x:0,y:0,scale:1,opacity:.5,locked:true,context:'schematic'};
  await importProject(page,p,{[hash]:encoded});await openReport(page);const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);await file.saveAs(`${folder}/transfer.tirta.json`);const original=JSON.parse(await readFile((await file.path())!,'utf8')) as {project:ProjectV2;formatVersion:number;attachmentData:Record<string,string>};expect(original.formatVersion).toBe(2);
  const context=await browser.newContext({serviceWorkers:'block'});const fresh=await context.newPage();await fresh.goto(new URL('/tirta.html',page.url()).href);await expect(fresh.locator('.local-projects > summary')).toContainText('(0)');await fresh.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles((await file.path())!);await expect(fresh.locator('.zone-row')).toHaveCount(5);await openReport(fresh);
  const [again]=await Promise.all([fresh.waitForEvent('download'),fresh.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);const restored=JSON.parse(await readFile((await again.path())!,'utf8')) as typeof original;
  for(const key of ['parameters','zones','science','components','scenarios','constraints','attachments','underlay','manualPlans','optionGroups','planningGoal','shortlist'] as const)expect(restored.project[key]).toEqual(original.project[key]);expect(restored.project.selectedPlan?.definition).toEqual(original.project.selectedPlan?.definition);expect(restored.project.selectedPlan?.decisionNote).toEqual(original.project.selectedPlan?.decisionNote);expect(restored.project.selectedPlan?.reviewedInputFingerprint).toBe(planningFingerprint(restored.project));expect(restored.attachmentData).toEqual(original.attachmentData);expect(restored.project.id).not.toBe(original.project.id);expect(restored.project.parameters.some(v=>v.value===null)).toBe(true);
  expect(evaluatePlan(restored.project,restored.project.selectedPlan!.definition,'r50')).toEqual(evaluatePlan(original.project,original.project.selectedPlan!.definition,'r50'));await context.close();
});

test('dense and UNKNOWN projects produce bounded reports, full long names and paginated artifacts',async({page})=>{
  for(const name of ['density-known','density-unknown','density-alternatives']){
    const wrapper=JSON.parse(await readFile(`evidence/uiux-candidate/fixtures/${name}.tirta.json`,'utf8')) as {project:ProjectV2};wrapper.project.name=`${name} — Sekolah dengan banyak zona dan intervensi untuk penilaian lengkap`;await importProject(page,wrapper.project);await openReport(page);await page.getByRole('switch',{name:'Sumber laporan'}).check();
    expect(buildProjectReport(wrapper.project,'r50',{includeSources:true,detail:'detailed'}).sections.some(s=>JSON.stringify(s).includes(wrapper.project.zones[0]!.name))).toBe(true);
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('button',{name:/^Unduh PDF/,exact:true})).toBeInViewport();
    const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Unduh PDF/,exact:true}).click()]);await file.saveAs(`${folder}/${name}.pdf`);expect((await readFile((await file.path())!)).subarray(0,5).toString()).toBe('%PDF-');await page.screenshot({path:`${folder}/${name}-mobile.png`});await page.keyboard.press('Escape');
  }
});

test('first PDF export works offline from cached production without previously loading its renderer',async({page})=>{
  const p=selected();await importProject(page,p);await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(()=>page.evaluate(async()=>{const keys=await caches.keys();const cache=await caches.open(keys.find(k=>k.startsWith('tirta-approved-'))!);const urls=(await cache.keys()).map(r=>r.url);return urls.some(u=>u.includes('pdfmake'))&&urls.some(u=>u.includes('vfs_fonts'));})).toBe(true);
  await openReport(page);await page.context().setOffline(true);
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/^Unduh PDF/,exact:true}).click()]);await file.saveAs(`${folder}/offline-first.pdf`);expect((await readFile((await file.path())!)).subarray(0,5).toString()).toBe('%PDF-');await page.context().setOffline(false);
});
