import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {demoProject,currentDemoProject,setActiveComponents,fmt} from '../src/direction/productionBridge';
import {unknownNumber} from '../src/domain/scientificContract';
import {planningFingerprint,snapshotPlan,evaluatePlan} from '../src/domain/planningEngine';
import {savePlanningLimits} from '../src/domain/planningWorkspace';
import type {ProjectV2} from '../src/domain/projectV2';
import {importNav,navBackup,watchNavErrors,expectNoNavErrors} from './navigator-helpers';
const out='E:/CodexStore/home/audits/tirta-surgical-2026-10-11/browser';
const conditional=()=>{const p=setActiveComponents(demoProject(),['garden']);p.scenarios=p.scenarios.filter(s=>s.id==='r50');p.constraints.requiredScenarioIds=[];const e=p.science!.interventions.garden!;e.soilInfiltration=unknownNumber('mm/h');e.groundwaterAssessment='unknown';e.groundwaterBasis='';return p;};
async function load(page:Page,p:ProjectV2){await importNav(page,p);await page.getByRole('button',{name:'Tutup Navigator',exact:true}).click();await expect(page.locator('.navigator-modal-backdrop')).toHaveCount(0);await go(page,'Studio Persil');}
async function go(page:Page,name:string){const button=page.locator('.app-rail nav').getByRole('button',{name,exact:true,includeHidden:true});if(!await button.isVisible()&&await page.locator('.view-project').isVisible()){if(name==='Rencana & Dampak'){await page.getByRole('navigation',{name:'Jelajahi alur TIRTA'}).getByRole('button',{name:/Bandingkan/}).click();await expect(page.locator('.view-alternatives')).toBeVisible();await button.click();return;}const label=({'Studio Persil':'Persil','Hujan & kondisi awal':'Hujan',Intervensi:'Intervensi',Bandingkan:'Bandingkan'} as Record<string,string>)[name];await page.getByRole('navigation',{name:'Jelajahi alur TIRTA'}).getByRole('button',{name:new RegExp(label!)}).click();return;}for(const d of await button.locator('xpath=ancestor::details').all())if(!await d.getAttribute('open'))await d.locator(':scope > summary').click();await button.click();}
async function report(page:Page){if(!await page.locator('.project-actions > summary').isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});const menu=page.locator('.project-actions');if(!await menu.getAttribute('open'))await menu.locator('summary').click();await menu.getByRole('button',{name:'Laporan proyek',exact:true}).click();return page.getByRole('dialog');}
async function field(page:Page,label:string){const composer=page.locator('.guided-composer');await composer.getByRole('button',{name:'Semua kebutuhan',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Semua kebutuhan penanganan'});await dialog.getByRole('button').filter({has:page.locator('span',{hasText:new RegExp(`${label}$`)})}).click();return composer;}
async function finishTreatment(page:Page){const c=page.locator('.guided-composer');for(let i=0;i<30;i++){const save=c.getByRole('button',{name:'Simpan penanganan',exact:true});if(await save.isVisible()){await save.click();return;}const skip=c.locator('.command-unknown');if(await skip.isVisible()){await skip.click();continue;}const next=c.getByRole('button',{name:'Selanjutnya',exact:true});if(await next.isVisible()){await next.click();continue;}throw new Error('Guided flow has no valid continuation');}throw new Error('Guided flow did not reach review');}
test.beforeEach(async({page})=>{await mkdir(out,{recursive:true});watchNavErrors(page);});
test.afterEach(async({page})=>expectNoNavErrors(page));
for(const [width,height] of [[1440,900],[1366,768],[768,1024],[390,844]] as const)test(`one-rain model with unknown site evidence: full workflow and report at ${width}`,async({page})=>{
 await page.setViewportSize({width,height});const p=conditional();await load(page,p);
 await page.screenshot({path:`${out}/studio-${width}.png`,fullPage:true});await go(page,'Hujan & kondisi awal');await expect(page.locator('.rain-atlas')).toBeVisible();await page.screenshot({path:`${out}/rain-${width}.png`,fullPage:true});
 await go(page,'Intervensi');await expect(page.locator('.intervention-ledger-region')).not.toHaveClass(/is-blocked/);await page.screenshot({path:`${out}/intervention-${width}.png`,fullPage:true});
 await go(page,'Bandingkan');await expect(page.locator('.comparison-rain-gate')).toHaveCount(0);if(width===390){await page.getByRole('button',{name:'Angka & pilihan',exact:true}).click();await page.locator('.compare-mobile-switch button').last().click();}
 await page.locator('.comparison-row').filter({hasText:'Rain garden'}).getByRole('button',{name:'Pilih rencana ini',exact:true}).click();await expect(page.locator('.plan-summary')).toBeVisible();
 await page.screenshot({path:`${out}/selected-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const saved=await navBackup(page,`surgical-selected-${width}`);const b=evaluatePlan(saved,saved.selectedPlan!.definition,'r50');expect(b.ok).toBe(true);if(b.ok){await go(page,'Rencana & Dampak');await expect(page.locator('.plan-mast-runoff')).toContainText(fmt(b.value.baseline));}
 const dialog=await report(page);const selector=dialog.getByRole('combobox',{name:'Paket dalam laporan',exact:true});expect(await selector.locator('option').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringContaining('Tanpa intervensi')]));
 await expect(dialog.getByRole('button',{name:/^Unduh PDF/})).toBeEnabled();await page.screenshot({path:`${out}/report-${width}.png`,fullPage:true});
 const axe=await new AxeBuilder({page}).include('.project-report-dialog').analyze();expect(axe.violations).toEqual([]);
 if(width===1440){const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:/^Unduh PDF/}).click()]);await download.saveAs(`${out}/intervention.pdf`);expect((await readFile(`${out}/intervention.pdf`)).subarray(0,5).toString()).toBe('%PDF-');}
 await dialog.getByRole('button',{name:'Tutup',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Lanjutkan dari sini',exact:true}).click();await page.waitForURL('**?view=studio');if(await page.getByRole('button',{name:'Tutup Navigator',exact:true}).isVisible())await page.getByRole('button',{name:'Tutup Navigator',exact:true}).click();
 const restored=await navBackup(page,`surgical-restored-${width}`);expect(restored.selectedPlan).toEqual(saved.selectedPlan);expect(restored.scenarios).toHaveLength(1);
});
test('new project creates exactly 50 and 100; no baseline-only report download',async({page})=>{
 await page.goto('/tirta.html');await page.getByLabel('Nama proyek',{exact:true}).fill('Proyek baru');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();await page.waitForURL('**?view=studio');const saved=await navBackup(page,'surgical-new-project');
 expect(saved.scenarios).toHaveLength(2);expect(saved.scenarios.map(s=>saved.parameters.find(v=>v.id===s.rainfall.id)!.value)).toEqual([50,100]);
 const dialog=await report(page);await expect(dialog.getByRole('button',{name:/^Unduh PDF/})).toBeDisabled();await expect(dialog.getByRole('button',{name:'Cadangan proyek',exact:true})).toBeEnabled();expect((await dialog.getByRole('combobox',{name:'Paket dalam laporan'}).locator('option').allTextContents()).join()).not.toContain('Tanpa intervensi');
});
test('typing and next preserve focus/scroll; real capacity cannot use misleading skip and field verification can',async({page})=>{
 const p=setActiveComponents(demoProject(),['tank']);await load(page,p);await go(page,'Intervensi');await page.locator('[data-component=tank] .instance-select').click();
 const composer=await field(page,'Kapasitas kejadian');await expect(composer.locator('.command-unknown')).toHaveCount(0);
 const input=composer.locator('[name=capacity]');await input.fill('');await input.pressSequentially('2.123',{delay:35});await expect(input).toHaveValue('2.123');await expect(input).toBeFocused();
 const position=await page.evaluate(()=>scrollY);await composer.getByRole('button',{name:'Selanjutnya',exact:true}).click();expect(Math.abs(await page.evaluate(()=>scrollY)-position)).toBeLessThanOrEqual(2);
 // An existing optional operation task remains skippable.
 await field(page,'Penggunaan & pengosongan');await expect(composer.locator('.command-unknown')).toBeVisible();await composer.locator('.command-unknown').click();await expect(composer).toBeVisible();
 await composer.getByRole('button',{name:'Batal',exact:true}).click();const after=await navBackup(page,'surgical-cancelled-typing');expect(after.parameters).toEqual(p.parameters);
});
test('non-model field edits preserve selection; legacy negative is visible and repairable through current fields',async({page})=>{
 let p=conditional();p.selectedPlan={definition:snapshotPlan(p,['garden'],'chosen','Pilihan'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan saya'};await load(page,p);await go(page,'Intervensi');await page.locator('[data-component=garden] .instance-select').click();const composer=await field(page,'Pemeliharaan');await composer.locator('[name=maintenance]').fill('Pemeriksaan mingguan');await finishTreatment(page);
 const saved=await navBackup(page,'surgical-verification-edit');expect(saved.selectedPlan!.reviewedInputFingerprint).toBe(planningFingerprint(saved));await go(page,'Rencana & Dampak');await expect(page.locator('.plan-summary')).toBeVisible();
 p=conditional();p.components.find(c=>c.id==='garden')!.siteAssessment={connection:'unknown',infiltration:'no',plantingSpace:'unknown',surfaceChange:'unknown',source:'Pernyataan lama yang harus ditinjau'};await load(page,p);await go(page,'Intervensi');await page.locator('[data-component=garden] .instance-select').click();await field(page,'Bukti infiltrasi tanah');const soilInput=composer.locator('[name=soil]');await soilInput.fill('');await soilInput.pressSequentially('7',{delay:35});await expect(soilInput).toHaveValue('7');await expect(soilInput).toBeFocused();await composer.getByRole('button',{name:'Selanjutnya',exact:true}).click();await composer.locator('[name=soilOrigin]').selectOption('user_supplied');await composer.locator('[name=soilSource]').fill('Koreksi pengguna untuk lokasi ini');await composer.getByRole('button',{name:'Selanjutnya',exact:true}).click();await finishTreatment(page);
 const repaired=await navBackup(page,'surgical-legacy-repaired');expect(repaired.components.find(c=>c.id==='garden')!.siteAssessment!.infiltration).toBe('yes');expect(repaired.components.find(c=>c.id==='garden')!.siteAssessment!.source).toContain('infiltration=no');
});
test('unanswered intervention dropdowns remain blank without selectable unknown labels or inferred defaults',async({page})=>{
 await load(page,conditional());await go(page,'Intervensi');await page.locator('[data-component=garden] .instance-select').click();const composer=await field(page,'Kondisi air tanah');
 const select=composer.locator('[name=groundwaterAssessment]');await expect(select).toHaveValue('unknown');expect((await select.locator('option:not([hidden])').allTextContents()).join()).not.toMatch(/Belum diketahui|Belum diperiksa/);
 await expect(composer.locator('.command-unknown')).toBeVisible();await composer.locator('.command-unknown').click();await finishTreatment(page);const saved=await navBackup(page,'surgical-unanswered');expect(saved.science!.interventions.garden!.groundwaterAssessment).toBe('unknown');expect(saved.science!.interventions.garden!.soilInfiltration.value).toBeNull();
});


test('new intervention palette exposes Biopori and never offers permeable conversion',async({page})=>{
 await load(page,demoProject());await go(page,'Intervensi');const palette=page.locator('.intervention-palette');
 await expect(palette.getByRole('button',{name:'Tambahkan Tangki'})).toBeVisible();
 await expect(palette.getByRole('button',{name:'Tambahkan Sumur / area resapan'})).toBeVisible();
 await expect(palette.getByRole('button',{name:'Tambahkan Rain garden'})).toBeVisible();
 await expect(palette.getByRole('button',{name:'Tambahkan Biopori'})).toBeVisible();
 await expect(palette.getByRole('button',{name:'Tambahkan Permukaan berpori'})).toHaveCount(0);
});


test('adding a treatment never invokes automatic viewport scrolling',async({page})=>{
 await load(page,demoProject());await go(page,'Intervensi');
 await page.evaluate(()=>{const w=window as Window & {__tirtaScrollCalls?:number};w.__tirtaScrollCalls=0;const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(...args){w.__tirtaScrollCalls=(w.__tirtaScrollCalls??0)+1;return original.apply(this,args as [boolean | ScrollIntoViewOptions]);};});
 await page.locator('.intervention-palette').getByRole('button',{name:'Tambahkan Tangki'}).click();await page.waitForTimeout(120);
 expect(await page.evaluate(()=>(window as Window & {__tirtaScrollCalls?:number}).__tirtaScrollCalls??0)).toBe(0);
});

test('presentation cleanup: no review CTA, no baseline candidate, lowest-residual plan is visibly highlighted',async({page})=>{
 const p=setActiveComponents(currentDemoProject(true),['tank','soak','garden','biopori']);
 p.manualPlans.push(snapshotPlan(p,[],'legacy-baseline','Tanpa intervensi'));
 await load(page,p);await go(page,'Intervensi');await page.locator('[data-component=tank] .instance-select').click();
 await expect(page.locator('.guided-composer').getByRole('button',{name:'Tinjau',exact:true})).toHaveCount(0);
 await go(page,'Bandingkan');const cards=page.locator('.compare-candidate');await expect(cards.first()).toBeVisible();
 await expect(cards.filter({hasText:'Tanpa intervensi'})).toHaveCount(0);expect(await page.locator('.compare-tradeoff-note').count()).toBeGreaterThan(0);
 const highlighted=page.locator('.compare-candidate.most-effective');expect(await highlighted.count()).toBeGreaterThan(0);
 const style=await highlighted.first().evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,border:s.borderColor,shadow:s.boxShadow};});
 expect(style.background).not.toBe('rgba(0, 0, 0, 0)');expect(style.border).not.toBe('rgba(0, 0, 0, 0)');expect(style.shadow).not.toBe('none');
});

test('intervention palette stays aligned and plan summary uses lightweight useful guidance',async({page})=>{
 const p=setActiveComponents(currentDemoProject(true),['tank','soak','garden','biopori']);
 p.selectedPlan={definition:snapshotPlan(p,['garden'],'chosen-visual','Pilihan visual'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Dipilih untuk uji tampilan'};
 await load(page,p);await go(page,'Intervensi');
 const buttons=page.locator('.intervention-palette > button');await expect(buttons).toHaveCount(4);
 const boxes=await buttons.evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();const art=node.querySelector('.intervention-illustration')!.getBoundingClientRect();return{top:b.top,height:b.height,artTop:art.top,artHeight:art.height};}));
 expect(Math.max(...boxes.map(x=>x.top))-Math.min(...boxes.map(x=>x.top))).toBeLessThanOrEqual(1);
 expect(Math.max(...boxes.map(x=>x.height))-Math.min(...boxes.map(x=>x.height))).toBeLessThanOrEqual(1);
 expect(Math.max(...boxes.map(x=>x.artTop))-Math.min(...boxes.map(x=>x.artTop))).toBeLessThanOrEqual(1);
 await go(page,'Rencana & Dampak');await expect(page.locator('.plan-flow-insight')).toBeVisible();await expect(page.locator('.plan-flow-insight')).toContainText('Makna cepat');
 const recommendation=page.getByRole('tab',{name:'Rekomendasi',exact:true});const pseudo=await recommendation.evaluate(el=>{const s=getComputedStyle(el,'::after');return{animation:s.animationName,filter:s.filter,border:s.borderStyle};});
 expect(pseudo.animation).toBe('none');expect(pseudo.filter).toBe('none');expect(pseudo.border).toContain('dashed');
});


test('applying plan limits during an open treatment edit updates the canonical project and visible meters immediately',async({page})=>{
 const p=setActiveComponents(demoProject(),['tank']);await load(page,p);await go(page,'Intervensi');
 await page.locator('[data-component=tank] .instance-select').click();await expect(page.locator('.guided-composer')).toBeVisible();
 await page.locator('.intervention-limit-summary').getByRole('button',{name:'Ubah batas',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Batas rencana Anda',exact:true});
 await dialog.locator('[name=budget]').fill('8000000');await dialog.locator('[name=land]').fill('24');
 await dialog.getByRole('button',{name:'Terapkan batas rencana',exact:true}).click();
 await expect(dialog.locator('.limits-saved')).toContainText('Diterapkan');
 await dialog.getByRole('button',{name:'Tutup',exact:true}).click();
 await expect(page.locator('.intervention-limit-summary')).toContainText('Rp8 jt');
 await expect(page.locator('.intervention-limit-summary')).toContainText('24 m²');
});

test('over-limit resources are visibly red while alternative exploration stays available and the over-limit package cannot be chosen',async({page})=>{
 let p=setActiveComponents(currentDemoProject(true),['tank']);
 p=savePlanningLimits(p,{text:'1000000',source:'Batas uji',evidence:'USER_INPUT'},{text:'24',source:'Batas uji',evidence:'USER_INPUT'});
 await load(page,p);await go(page,'Intervensi');
 const budget=page.locator('.intervention-limit-summary .constraint-meter').filter({hasText:'Biaya'});
 await expect(budget).toContainText('Melebihi batas dana');
 const bar=budget.locator('.meter-track > span');
 await expect(bar).toHaveClass(/over-limit/);
 const color=await bar.evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(color).not.toBe('rgb(0, 159, 158)');
 const alternatives=page.getByRole('button',{name:'Lihat alternatif',exact:true});await expect(alternatives).toBeEnabled();await alternatives.click();
 await expect(page.locator('.view-alternatives')).toBeVisible();
 await expect(page.getByRole('button',{name:'Pilih rencana ini',exact:true})).toHaveCount(0);
});
