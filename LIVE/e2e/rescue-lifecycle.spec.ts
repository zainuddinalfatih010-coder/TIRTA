import { test, expect } from '@playwright/test';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { evaluatePlan, planningFingerprint, snapshotPlan } from '../src/domain/planningEngine';

test('a selected subset uses the canonical registry for every rain result', async ({page}) => {
  const p = setActiveComponents(demoProject(), ['tank','soak','garden']);
  const definition = snapshotPlan(p,['tank'],'rescue-tank','Tangki pilihan');
  p.selectedPlan = {definition, reviewedInputFingerprint:planningFingerprint(p), decisionNote:''};
  for (const s of p.scenarios) expect(evaluatePlan(p,definition,s.id).ok).toBe(true);
  await page.goto('/tirta.html');
  const file = page.getByLabel('Buka berkas cadangan');
  for (const d of await file.locator('xpath=ancestor::details').all()) if (!await d.getAttribute('open')) await d.locator(':scope > summary').click();
  await file.setInputFiles({name:'selected-subset.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});
  const b = page.locator('.app-rail nav').getByRole('button',{name:'Rencana & Dampak',exact:true,includeHidden:true});
  for (const d of await b.locator('xpath=ancestor::details').all()) if (!await d.getAttribute('open')) await d.locator(':scope > summary').click();
  await b.click();
  await expect(page.locator('.plan-scenario-compact')).not.toContainText('Belum dapat dinilai');
  await expect(page.locator('.plan-scenario-compact strong')).toHaveCount(p.scenarios.length);
  await page.reload();
  await page.locator('.local-projects > summary').click();
  await page.locator('.local-projects button').filter({hasText:p.name}).first().click();
  for (const d of await b.locator('xpath=ancestor::details').all()) if (!await d.getAttribute('open')) await d.locator(':scope > summary').click();
  await b.click();
  await expect(page.locator('.plan-scenario-compact')).not.toContainText('Belum dapat dinilai');
});

test('empty guided confirmation stays on the missing step; an explicit draft remains possible',async({page})=>{
  await page.goto('/tirta.html');
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  const b=page.locator('.app-rail nav').getByRole('button',{name:'Intervensi',exact:true,includeHidden:true});
  for(const d of await b.locator('xpath=ancestor::details').all()) if(!await d.getAttribute('open'))await d.locator(':scope > summary').click();
  await b.click();
  await page.getByRole('button',{name:'Tambahkan Tangki',exact:true}).click();
  await page.locator('.treatment-composer').getByRole('button',{name:'Lanjut',exact:false}).click();
  await expect(page.locator('.treatment-stages button').nth(1)).toHaveAttribute('aria-current','step');
  await expect(page.locator('.treatment-composer .field-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Simpan penanganan',exact:true}).click();
  await expect(page.locator('.composer-saved')).toContainText('Perubahan tersimpan');
});

test('duplicate actions remain readable, create an independent draft and show live resource use',async({page})=>{
  const p=setActiveComponents(demoProject(),['tank','soak','garden']);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tirta.html');const file=page.getByLabel('Buka berkas cadangan');
  for(const d of await file.locator('xpath=ancestor::details').all())if(!await d.getAttribute('open'))await d.locator(':scope > summary').click();
  await file.setInputFiles({name:'duplicate-test.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});
  const nav=page.locator('.app-rail nav').getByRole('button',{name:'Intervensi',exact:true,includeHidden:true});
  for(const d of await nav.locator('xpath=ancestor::details').all())if(!await d.getAttribute('open'))await d.locator(':scope > summary').click();await nav.click();
  await page.getByRole('button',{name:'Tindakan Tangki atap',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Tangki atap',exact:true});
  await expect(dialog).toBeVisible();
  const copy=dialog.getByRole('button',{name:'Buat salinan',exact:false});
  expect((await copy.boundingBox())!.width).toBeGreaterThan(150);
  await copy.click();
  await expect(page.locator('.treatment-heading h2')).toContainText('Tangki atap (salinan)');
  await page.getByRole('button',{name:'2 Kapasitas',exact:true}).click();
  await expect(page.locator('.treatment-composer input[name=capacity]')).toHaveValue('');
  await page.getByRole('button',{name:'3 Biaya & lahan',exact:true}).click();
  await page.getByLabel('Biaya (Rp)',{exact:true}).fill('6000000');
  await page.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('6');
  await expect(page.getByRole('region',{name:'Pratinjau biaya dan ruang'})).toContainText('50%');
  await expect(page.getByRole('region',{name:'Pratinjau biaya dan ruang'})).toContainText('25%');
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
