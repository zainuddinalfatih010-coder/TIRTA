import {test,expect,type Page} from '@playwright/test';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {projectBackup} from '../src/persistence/portable';
import {planningFingerprint,snapshotPlan,optimize,evaluateEventPlan} from '../src/domain/planningEngine';
import type {ProjectV2} from '../src/domain/projectV2';
import {readFile,mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const out='evidence/uiux-candidate/intervention-lifecycle/transactions';
const errors=new Map<Page,string[]>();
test.beforeEach(async({page})=>{await mkdir(out,{recursive:true});const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text());});});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});
async function load(page:Page,p= setActiveComponents(demoProject(),[])){
 await page.goto('/tirta.html');const input=page.getByLabel('Buka berkas cadangan');for(const d of await input.locator('xpath=ancestor::details').all())if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();
 await input.setInputFiles({name:'lifecycle.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});await page.getByRole('button',{name:'Intervensi',exact:true}).click();return p;
}
async function backup(page:Page,name:string):Promise<ProjectV2>{
 const menu=page.locator('.project-actions');if(await menu.getAttribute('open')===null)await menu.locator(':scope > summary').click();await menu.getByRole('button',{name:'Laporan proyek',exact:true}).click();const dialog=page.getByRole('dialog',{name:/Laporan draf|Laporan alternatif|Rencana pilihan|Rencana lama/});const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);await download.saveAs(`${out}/${name}.tirta.json`);const p=JSON.parse(await readFile(`${out}/${name}.tirta.json`,'utf8')).project;await dialog.getByRole('button',{name:'Tutup',exact:true}).click();return p;
}
test('explore click/keyboard/multi-click and cancel preserve chosen plan, sources, resources and alternatives',async({page})=>{
 let p=setActiveComponents(demoProject(),[]);p.selectedPlan={definition:snapshotPlan(p,[],'chosen','Tanpa intervensi'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan pengguna'};await load(page,p);p=await backup(page,'initial-imported');expect(p.selectedPlan!.reviewedInputFingerprint).toBe(planningFingerprint(p));
 for(const method of ['Biopori','Tangki','Rain garden']){
  const b=page.getByRole('button',{name:`Tambahkan ${method}`,exact:true});if(method==='Tangki'){await b.focus();await page.keyboard.press('Enter');}else await b.click();
  await expect(page.locator('.intervention-option')).toHaveCount(0);await expect(page.locator('.treatment-source-chips > span')).toHaveCount(0);await expect(page.locator('.workspace > .field-decision-readiness')).toHaveCount(0);
 }
 await page.screenshot({path:out+'/after-exploration.png',fullPage:true});await page.getByRole('button',{name:'Batal',exact:true}).click();const after=await backup(page,'after-explore');expect(planningFingerprint(after)).toBe(planningFingerprint(p));expect(after.selectedPlan).toEqual(p.selectedPlan);expect(optimize(after,'r50')).toEqual(optimize(p,'r50'));
});
test('contextual source is intentional; save-for-later, activate, delete are distinct',async({page})=>{
 await load(page);await page.getByTestId('zone-z0').click({position:{x:20,y:20}});await page.getByRole('button',{name:'Tangani air dari sini',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Tangki',exact:true}).click();
 await expect(page.locator('.treatment-source-chips')).toContainText('Gedung belajar');await page.getByRole('button',{name:'Simpan untuk nanti',exact:true}).click();await expect(page.locator('.intervention-option')).toHaveCount(0);const saved=await backup(page,'deferred');expect(saved.components.filter(c=>c.enabled)).toHaveLength(0);expect(saved.components.find(c=>c.name==='Tangki')?.targets).toEqual(['z0']);
 await page.locator('.deferred-treatments > summary').click();await page.locator('.deferred-treatments button').filter({hasText:/^TangkiPertimbangkan lagi$/}).click();await expect(page.locator('.intervention-option')).toHaveCount(1);await page.getByRole('button',{name:'Tindakan Tangki',exact:true}).click();await page.getByRole('button',{name:'Hapus penanganan',exact:true}).click();await expect(page.locator('.intervention-option')).toHaveCount(0);const deleted=await backup(page,'deleted');expect(deleted.components.some(c=>c.name==='Tangki')).toBe(false);
});
test('tab and next navigation do not commit; incomplete active Biopori is not silently baseline-only',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).click();await expect(page.locator('.treatment-heading h2')).toHaveText('Biopori');await page.getByRole('button',{name:'Lanjut',exact:true}).click();await expect(page.locator('.treatment-stages button').nth(1)).toHaveAttribute('aria-current','step');await expect(page.locator('.intervention-option')).toHaveCount(0);await page.getByRole('button',{name:'3 Biaya & lahan',exact:true}).click();await page.getByRole('button',{name:'Simpan penanganan',exact:true}).click();await expect(page.locator('.intervention-option')).toHaveCount(1);
 await page.getByRole('button',{name:'Lihat alternatif',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Sebelum membandingkan penanganan'});await expect(dialog).toBeVisible();await expect(dialog).toContainText('Tanah terbuka');await dialog.getByRole('button',{name:'Lihat kondisi awal saja',exact:true}).click();await expect(page.getByRole('region',{name:'Biopori belum masuk perbandingan'})).toBeVisible();await page.screenshot({path:out+'/after-excluded-biopori.png',fullPage:true});await page.getByRole('button',{name:'Lengkapi Biopori',exact:true}).click();await expect(page.getByRole('dialog',{name:'Pilih lokasi penerapan'})).toBeVisible();
});

test('saved intervention data survives comparison, plan selection and return',async({page})=>{
 const beforeProject=setActiveComponents(demoProject(true),['tank','soak','garden']);await load(page,beforeProject);const before=await backup(page,'roundtrip-before');
 await page.getByRole('button',{name:'Lihat alternatif',exact:true}).click();const choose=page.locator('.comparison-row').first().getByRole('button',{name:'Pilih rencana ini',exact:true});await expect(choose).toBeVisible();await choose.click();
 await page.getByRole('button',{name:'Intervensi',exact:true}).click();await expect(page.getByRole('heading',{level:1,name:'Rancang Penanganan',exact:true})).toBeVisible();const after=await backup(page,'roundtrip-after');
 expect(after.components).toEqual(before.components);expect(after.parameters).toEqual(before.parameters);expect(after.science).toEqual(before.science);
});

test('dirty intervention draft cannot be abandoned by navigation',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Tambahkan Tangki',exact:true}).click();
 await page.getByRole('button',{name:'Semua kebutuhan',exact:true}).click();const needs=page.getByRole('dialog',{name:'Semua kebutuhan penanganan'});await needs.getByRole('button').filter({hasText:'Biaya'}).first().click();
 const cost=page.getByLabel('Biaya (Rp)',{exact:true});await cost.fill('12345');await page.getByRole('button',{name:'Lihat alternatif',exact:true}).click();
 await expect(page.getByRole('heading',{level:1,name:'Rancang Penanganan',exact:true})).toBeVisible();await expect(page.getByText(/Simpan penanganan atau Batal/i)).toBeVisible();await expect(cost).toHaveValue('12.345');
});
test('known and partial resources remain visible despite unknown water; 390px editor/readiness',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).click();await page.getByRole('button',{name:'3 Biaya & lahan',exact:true}).click();await page.getByLabel('Biaya (Rp)',{exact:true}).fill('30000');await page.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('6');await page.getByRole('button',{name:'Simpan penanganan',exact:true}).click();const known=await backup(page,'known-resources');expect(evaluateEventPlan(known,snapshotPlan(known,known.components.filter(c=>c.enabled).map(c=>c.id),'water','water'),'r50').ok).toBe(false);await expect(page.locator('.intervention-limit-summary')).toContainText(/30/);await expect(page.locator('.intervention-limit-summary')).toContainText('6 m²');
 await page.getByRole('button',{name:'Tambahkan Tangki',exact:true}).click();await page.getByRole('button',{name:'3 Biaya & lahan',exact:true}).click();await page.getByRole('button',{name:'Simpan penanganan',exact:true}).click();await expect(page.locator('.intervention-limit-summary')).toContainText('1 biaya belum diketahui');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:out+'/after-mobile390.png',fullPage:true});await page.getByRole('button',{name:'Periksa kesiapan',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sebelum membandingkan penanganan'})).toBeVisible();
});
test('novice Biopori declares site/source/capacity then one site check; result and PDF use committed data',async({page})=>{
 await load(page);await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).click();const c=page.locator('.treatment-composer');
 await c.locator('[data-role-choice=installation]').click();const site=page.getByRole('dialog',{name:'Pilih lokasi penerapan'});await expect(site).not.toContainText('Gedung belajar');await site.getByRole('button',{name:/^Tanah timur/}).click();
 await c.locator('[data-role-choice=source]').click();await page.getByRole('dialog',{name:'Pilih sumber limpasan'}).getByRole('button',{name:/^Gedung belajar/}).click();await c.locator('[name=via]').selectOption('gutter-downpipe');await c.locator('[name=catchmentReviewed]').check();
 await c.getByRole('button',{name:'Lanjut',exact:true}).click();await c.locator('[name=capacity]').fill('0.12');await c.locator('[name=capacityBasis]').selectOption('user-entered');await c.getByRole('button',{name:'Lanjut',exact:true}).click();await c.locator('[name=cost]').fill('30000');await c.locator('[name=area]').fill('6');await c.getByRole('button',{name:'Simpan penanganan',exact:true}).click();
 await expect(page.locator('.intervention-water-ledger')).toContainText('Bukti infiltrasi tanah belum tersedia');await page.locator('.intervention-water-ledger').getByRole('button',{name:'Tinjau bukti tanah',exact:true}).click();const review=page.getByRole('dialog',{name:'Kelayakan Biopori'});await review.locator('[name=soil]').fill('8');await review.locator('[name=soilOrigin]').selectOption('user_supplied');await review.locator('[name=soilSource]').fill('Asumsi sintetis untuk uji, bukan data lapangan');await review.locator('[name=groundwaterAssessment]').selectOption('suitable');await review.locator('[name=groundwaterBasis]').fill('Deklarasi sintetis untuk menguji alur');await review.getByRole('button',{name:'Simpan tinjauan',exact:true}).click();
 await expect(page.locator('.intervention-water-ledger')).toContainText('Belum dihitung');await c.getByRole('button',{name:'Simpan penanganan',exact:true}).click();await expect(page.locator('.intervention-water-ledger')).toContainText('0,12 m³');const saved=await backup(page,'novice-biopori');const active=saved.components.filter(x=>x.enabled);expect(active).toHaveLength(1);expect(active[0]!.targets).toEqual(['z0']);expect(active[0]!.treatment?.installationZoneId).toBe('z2');
 await page.getByRole('button',{name:'Lihat alternatif',exact:true}).click();await expect(page.getByRole('dialog',{name:'Sebelum membandingkan penanganan'})).toHaveCount(0);const row=page.locator('.comparison-row').filter({hasText:'Biopori'});await expect(row).toBeVisible();await row.getByRole('button',{name:'Pilih rencana ini',exact:true}).click();const chosen=await backup(page,'novice-chosen');expect(chosen.selectedPlan!.definition.components[0]!.id).toBe(active[0]!.id);
 const menu=page.locator('.project-actions');if(await menu.getAttribute('open')===null)await menu.locator(':scope > summary').click();await menu.getByRole('button',{name:'Laporan proyek',exact:true}).click();const dialog=page.getByRole('dialog',{name:/Laporan draf|Laporan alternatif|Rencana pilihan|Rencana lama/});const [dl]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:/^Unduh PDF/,exact:true}).click()]);await dl.saveAs(out+'/novice-biopori.pdf');expect((await readFile(out+'/novice-biopori.pdf')).subarray(0,5).toString()).toBe('%PDF-');await dialog.getByRole('button',{name:'Tutup',exact:true}).click();await page.screenshot({path:out+'/novice-plan.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test.describe("touch editing",()=>{
test.use({hasTouch:true,viewport:{width:390,height:844}});
test('touch exploration leaves an existing selected tank current; explicit cancel discards the local change',async({page})=>{
 let p=setActiveComponents(demoProject(),['tank']);p.selectedPlan={definition:snapshotPlan(p,['tank'],'chosen-tank','Tangki pilihan pengguna'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan saya'};await load(page,p);p=await backup(page,'touch-before');
 await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).tap();await expect(page.locator('.treatment-heading h2')).toHaveText('Biopori');await expect(page.locator('.treatment-source-chips > span')).toHaveCount(0);await expect(page.locator('.intervention-option')).toHaveCount(1);
 const save=page.getByRole('button',{name:'Simpan penanganan',exact:true});const box=await save.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);await page.getByRole('button',{name:'Batal',exact:true}).tap();const after=await backup(page,'touch-after');expect(after.selectedPlan).toEqual(p.selectedPlan);expect(planningFingerprint(after)).toBe(planningFingerprint(p));expect(optimize(after,'r50')).toEqual(optimize(p,'r50'));await page.screenshot({path:out+'/touch-selected-current.png',fullPage:true});
});

});
