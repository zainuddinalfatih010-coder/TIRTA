import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {demoProject} from '../src/direction/productionBridge';
import {saveRain} from '../src/domain/planningAuthoring';
import {projectBackup} from '../src/persistence/portable';
import {mkdir} from 'node:fs/promises';
const evidence='E:/CodexStore/home/audits/tirta-rescue-2026-10-07/studio-after';
test('setup and tools never overlap, then mobile drawing owns useful screen space',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await mkdir(evidence,{recursive:true});await page.setViewportSize({width:390,height:844});await page.goto('/tirta.html');
  await page.getByLabel('Nama proyek',{exact:true}).fill('Uji persil baru');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
  await expect(page.locator('.zone-navigator-list')).toContainText('Buat batas persil terlebih dahulu');
  const setup=await page.locator('.parcel-start').boundingBox(),tools=await page.locator('.mobile-studio-tools').boundingBox();
  expect(setup!.y).toBeGreaterThanOrEqual(tools!.y+tools!.height);
  await page.getByLabel('Panjang persil',{exact:true}).fill('10');await page.getByLabel('Lebar persil',{exact:true}).fill('10');await page.getByRole('button',{name:'Buat persil',exact:true}).click();
  await expect(page.locator('.zone-navigator-list')).toContainText('Gunakan Zona');
  const canvas=await page.locator('.studio-layout .parcel-svg').boundingBox();expect(canvas!.height).toBeGreaterThanOrEqual(300);
  expect(canvas!.y).toBeLessThan(550);
  await page.screenshot({path:`${evidence}/fresh-mobile.png`,fullPage:true});
  for(const width of [390,768,960,1024,1366,1440,1920]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width>960){await expect(page.locator('.studio-inspector')).toBeVisible();expect((await page.locator('.studio-layout .parcel-svg').boundingBox())!.height).toBeGreaterThanOrEqual(480);}
  }
  expect((await new AxeBuilder({page}).include('.view-studio').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});
test('fresh rainfall examples require a click and persist as test data',async({page})=>{
  let p=demoProject();for(const s of p.scenarios)p=saveRain(p,s.id,'Hujan uji',{text:'',source:'',evidence:'UNKNOWN'},'Belum dinyatakan');
  await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan').setInputFiles({name:'unknown-rain.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});
  await page.locator('.app-rail nav').getByRole('button',{name:'Hujan & kondisi awal',exact:true}).click();
  await expect(page.getByLabel('Kedalaman hujan',{exact:true})).toHaveValue('');
  await page.getByRole('group',{name:'Contoh hujan untuk pengujian'}).getByRole('button',{name:'50 mm',exact:true}).click();
  await expect(page.getByLabel('Kedalaman hujan',{exact:true})).toHaveValue('50');
  await expect(page.locator('.runoff-reading strong')).toContainText('6,27');
  await page.getByLabel('Kedalaman hujan',{exact:true}).fill('75');await page.getByRole('button',{name:'Terapkan hujan & hitung ulang',exact:true}).click();
  await expect(page.locator('.runoff-reading strong')).toContainText('9,4');
  await expect(page.locator('.rain-scenario-picker')).not.toContainText('50 mm');
});
