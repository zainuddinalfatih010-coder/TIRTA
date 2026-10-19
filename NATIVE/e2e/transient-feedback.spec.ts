import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
const out='evidence/uiux-candidate/transient-feedback';
const routes={project:'Proyek',studio:'Studio Persil',rain:'Hujan & kondisi awal',interventions:'Intervensi',alternatives:'Alternatif',compare:'Bandingkan',impact:'Rencana & Dampak'};
async function navigate(page:Page,route:keyof typeof routes|'assistant') {
 const button=route==='assistant'?page.getByRole('button',{name:'Tanya TIRTA',exact:true}):page.locator('.app-rail nav').getByRole('button',{name:routes[route],exact:true,includeHidden:true});
 for(const d of await button.locator('xpath=ancestor::details').all()) await d.evaluate(el=>(el as HTMLDetailsElement).open=true);
 await button.focus(); await page.keyboard.press('Enter');
}
async function box(page:Page,selector:string) {
 return page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};});
}
async function screenshot(page:Page,name:string) {await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/${name}.png`});}
const runtimeErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];runtimeErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await page.goto('/tirta.html');await page.evaluate(()=>document.fonts.ready);});
test.afterEach(async({page})=>{expect(runtimeErrors.get(page)).toEqual([]);});

for(const [width,height] of [[1920,1080],[1366,768],[900,700],[390,844]] as const) test(`missing project: overlay, exact-field focus, two-second dismissal and stable layout at ${width}`,async({page})=>{
 await page.setViewportSize({width,height});const before=await box(page,'.landing-hero');
 await navigate(page,'rain');const popup=page.locator('.notice-warning');await expect(popup).toContainText('Buat atau buka proyek');
 await expect(page.getByLabel('Nama proyek',{exact:true})).toBeFocused();
 expect(await box(page,'.landing-hero')).toEqual(before);await expect(page.locator('.workspace > .recovery-resume')).toHaveCount(0);
 const size=await popup.evaluate(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {fixed:c.position==='fixed',inside:r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1,compact:r.height<150};});
 expect(size).toEqual({fixed:true,inside:true,compact:true});
 expect((await new AxeBuilder({page}).include('.notice').analyze()).violations).toEqual([]);
 await screenshot(page,`project-warning-${width}`);
 await expect(popup).toHaveCount(0,{timeout:2500});expect(await box(page,'.landing-hero')).toEqual(before);
 await expect(page.getByLabel('Nama proyek',{exact:true})).toBeFocused();
});

test('repeated missing-data navigation restarts the two-second timer; X and Escape dismiss without scrolling',async({page})=>{
 await navigate(page,'rain');await page.waitForTimeout(1200);await navigate(page,'rain');await page.waitForTimeout(1000);
 await expect(page.locator('.notice-warning')).toBeVisible();
 await expect(page.locator('.notice-warning')).toHaveCount(0,{timeout:1500});
 await navigate(page,'rain');await page.getByRole('button',{name:'Tutup pemberitahuan'}).focus();const scroll=await page.evaluate(()=>scrollY);
 await page.keyboard.press('Escape');await expect(page.locator('.notice')).toHaveCount(0);expect(await page.evaluate(()=>scrollY)).toBe(scroll);
 await navigate(page,'rain');await page.getByRole('button',{name:'Tutup pemberitahuan'}).click();await expect(page.locator('.notice')).toHaveCount(0);
});

test('missing C remains blocked after toast expires; header reopens the overlay without moving Studio',async({page})=>{
 await page.getByLabel('Nama proyek',{exact:true}).fill('Uji koefisien');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
 await page.getByLabel('Panjang persil').fill('15');await page.getByLabel('Lebar persil').fill('10');await page.getByRole('button',{name:'Buat persil',exact:true}).click();
 await page.getByRole('button',{name:'Zona',exact:true}).click();await page.getByRole('button',{name:'Seluruh persil',exact:true}).click();await page.getByLabel('Jenis permukaan',{exact:true}).selectOption('roof');
 const before=await box(page,'.studio-layout');await navigate(page,'rain');await expect(page.locator('.coefficient-launch')).toBeFocused();
 await expect(page.locator('.notice-warning')).toBeVisible();expect(await box(page,'.studio-layout')).toEqual(before);
 await expect(page.locator('.notice-warning')).toHaveCount(0,{timeout:2500});await expect(page.locator('.view-studio')).toBeVisible();
 await page.locator('.readiness-trigger').click();await expect(page.getByRole('region',{name:'Kelengkapan untuk melanjutkan'})).toBeVisible();expect(await box(page,'.studio-layout')).toEqual(before);
 await page.getByRole('button',{name:'Tutup panduan isian'}).click();await expect(page.locator('.notice-warning')).toBeVisible();expect(await box(page,'.studio-layout')).toEqual(before);
 await screenshot(page,'studio-warning');
});

test('save feedback floats without shifting any of the eight populated pages at desktop, tablet and mobile',async({page})=>{
 const input=page.getByLabel('Buka berkas cadangan');await input.setInputFiles('evidence/uiux-candidate/treatment/declared-four-family-demo.tirta.json');await expect(page.locator('.view-studio')).toBeVisible();
 for(const width of [1440,900,390]) {
  await page.setViewportSize({width,height:844});
  for(const route of [...Object.keys(routes),'assistant'] as (keyof typeof routes|'assistant')[]) {
   await navigate(page,route);await expect(page.locator(`.view-${route}`)).toBeVisible();
   const notice=page.getByRole('button',{name:'Tutup pemberitahuan'});if(await notice.isVisible())await notice.click();
   const before=await box(page,'.workspace');
   await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Simpan',exact:true}).click();
   await expect(page.locator('.notice')).toBeVisible();expect(await box(page,'.workspace')).toEqual(before);
   const size=await page.locator('.notice').evaluate(el=>{const r=el.getBoundingClientRect();return {height:r.height,viewport:innerHeight};});expect(size.height).toBeLessThan(Math.min(180,size.viewport));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   if(route==='rain'||route==='interventions'||route==='compare') await screenshot(page,`${route}-${width}`);
   await page.getByRole('button',{name:'Tutup pemberitahuan'}).click();
  }
 }
});
