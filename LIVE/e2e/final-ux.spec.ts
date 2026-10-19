import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {projectBackup} from '../src/persistence/portable';
const out='evidence/uiux-candidate/intervention-lifecycle/final-ux';
async function nav(page:Page,name:string){const b=page.locator('.app-rail nav').getByRole('button',{name,exact:true,includeHidden:true});for(const d of await b.locator('xpath=ancestor::details').all())if(!await d.getAttribute('open'))await d.locator(':scope > summary').click();await b.click();}
test('mobile comparison makes the next decision visible without choosing a plan on checkbox selection',async({page})=>{
  await mkdir(out,{recursive:true});await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan').setInputFiles({name:'compare.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(setActiveComponents(demoProject(),['tank'])))});
  await nav(page,'Bandingkan');await page.locator('.compare-mobile-view').getByRole('button',{name:'Pilih paket',exact:true}).click();
  const next=page.getByRole('button',{name:'Lihat angka & pilih rencana',exact:true});await expect(next).toBeVisible();
  await expect(page.locator('.compare-navigator')).toContainText('Sedang dibandingkan');
  await expect(page.locator('.view-alternatives')).not.toContainText('Rencana pilihan Anda');
  await next.click();await expect(page.locator('.compare-matrix-section h2')).toBeFocused();
  const choose=page.getByRole('button',{name:'Pilih rencana ini',exact:true}).first();await expect(choose).toBeVisible();await choose.hover();
  await page.screenshot({path:`${out}/comparison-mobile.png`,fullPage:true});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button',{name:'Pilih rencana ini',exact:true}).first().click();await expect(page.locator('.plan-masthead')).toContainText('Pilihan Anda');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('saved later choices and disclosed sources use human labels, not canonical state enums',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'empty-demo-options.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup({...setActiveComponents(demoProject(),[]),name:"Contoh TIRTA"}))});await nav(page,'Intervensi');
  await expect(page.locator('.deferred-treatments > summary')).toContainText('Disimpan untuk nanti');
  await nav(page,'Hujan & kondisi awal');const sources=page.locator('.source-note').filter({has:page.locator('.source-ledger')});await sources.locator(':scope > summary').click();
  await expect(sources).not.toContainText('DEMO');await expect(sources).not.toContainText('UNKNOWN');await expect(sources).toContainText('data demo');
});
test('choosing the initial condition clearly says no treatment and no automatic recommendation',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'empty-demo-options.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup({...setActiveComponents(demoProject(),[]),name:"Contoh TIRTA"}))});await nav(page,'Intervensi');await page.getByRole('button',{name:'Lihat alternatif',exact:true}).click();await page.getByRole('button',{name:'Bandingkan kondisi awal',exact:true}).click();await page.getByRole('button',{name:'Pilih rencana ini',exact:true}).first().click();
  await expect(page.locator('.plan-summary')).toContainText('Anda memilih kondisi awal tanpa penanganan. Ini bukan rekomendasi otomatis.');
});
test('an incomplete Biopori idea can be saved aside without losing entered resources or adding a shared-source blocker',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'empty-demo-options.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup({...setActiveComponents(demoProject(),[]),name:"Contoh TIRTA"}))});await nav(page,'Intervensi');await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).click();
  const composer=page.locator('.treatment-composer');await composer.locator('.treatment-stages').getByRole('button',{name:/Biaya & lahan/}).click();await expect(composer).toContainText('Isian kosong boleh disimpan');await composer.getByLabel('Biaya (Rp)',{exact:true}).fill('120000');await composer.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('2');await composer.getByLabel('Nama penanganan (opsional)',{exact:true}).fill('Biopori untuk ditinjau');
  await composer.getByRole('button',{name:'Simpan untuk nanti',exact:true}).click();await expect(page.locator('.deferred-treatments')).toContainText('Biopori untuk ditinjau');await expect(page.locator('.intervention-instance-list')).not.toContainText('Biopori untuk ditinjau');await expect(page.getByRole('status',{name:'Tersimpan lokal',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Tambahkan Tangki',exact:true}).click();await expect(page.locator('.shared-source-warning')).toHaveCount(0);await expect(page.getByRole('status',{name:'Isian belum disimpan',exact:true})).toBeVisible();
  await page.reload();await page.locator('.local-projects > summary').click();await page.locator('.local-projects button').filter({hasText:'Contoh TIRTA'}).first().click();await nav(page,'Intervensi');await page.locator('.deferred-treatments > summary').click();await page.locator('.deferred-treatments button').filter({hasText:'Biopori untuk ditinjau'}).click();
  await expect(composer.locator('.treatment-heading')).toContainText('Biopori untuk ditinjau');await composer.locator('.treatment-stages').getByRole('button',{name:/Biaya & lahan/}).click();await expect(composer.getByLabel('Biaya (Rp)',{exact:true})).toHaveValue('120.000');await expect(composer.getByLabel('Ruang terpakai (m²)',{exact:true})).toHaveValue('2');await composer.locator('.treatment-stages').getByRole('button',{name:/Kapasitas/}).click();await expect(composer.locator('[name=capacity]')).toHaveValue('');
});
test('a missing installation focuses its picker and saved resource values never claim to be unsaved',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'empty-demo-options.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup({...setActiveComponents(demoProject(),[]),name:"Contoh TIRTA"}))});await nav(page,'Intervensi');await page.getByRole('button',{name:'Tambahkan Biopori',exact:true}).click();const composer=page.locator('.treatment-composer');await composer.getByRole('button',{name:'Simpan penanganan',exact:true}).click();await page.getByRole('button',{name:'Periksa kesiapan',exact:true}).click();await page.getByRole('dialog',{name:'Sebelum membandingkan penanganan'}).getByRole('button',{name:'Pilih lokasi Biopori',exact:true}).click();await expect(page.getByRole('dialog',{name:'Pilih lokasi penerapan',exact:true})).toBeVisible();await page.getByRole('dialog',{name:'Pilih lokasi penerapan',exact:true}).getByRole('button',{name:'Tutup',exact:true}).click();
  await composer.locator('.treatment-stages').getByRole('button',{name:/Biaya & lahan/}).click();await composer.getByLabel('Biaya (Rp)',{exact:true}).fill('1000');await composer.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('1');await expect(composer.locator('.resource-draft')).toContainText('Belum disimpan');await composer.getByRole('button',{name:'Simpan penanganan',exact:true}).click();await expect(composer.locator('.resource-draft')).not.toContainText('Belum disimpan');await composer.getByLabel('Biaya (Rp)',{exact:true}).fill('2000');await expect(composer.locator('.resource-draft')).toContainText('Belum disimpan');
});
test('a chosen treatment is named before its impact diagram and the next field check is discoverable',async({page})=>{
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan').setInputFiles({name:'tank.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(setActiveComponents(demoProject(),['tank'])))});await nav(page,'Bandingkan');const tank=page.locator('.comparison-row').filter({hasText:'Tangki'}).first();await tank.getByRole('button',{name:'Pilih rencana ini',exact:true}).click();await expect(page.locator('.plan-masthead h2')).toContainText('Tangki atap');await expect(page.locator('.plan-first-check').getByRole('button',{name:'Periksa sebelum pemasangan',exact:true})).toBeVisible();await expect(page.locator('.plan-first-check')).not.toContainText('UNKNOWN');
});
