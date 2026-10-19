import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
const folder=process.env.TIRTA_ROOF_EVIDENCE??'evidence/uiux-candidate/roof-pitch';
async function route(page:Page,name:string){
  const mobile=page.getByLabel('Ruang kerja',{exact:true});
  if(await mobile.isVisible())await mobile.selectOption({label:name});
  else if(name==='Proyek'&&!await page.locator('.app-rail nav').getByRole('button',{name,exact:true}).isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});
  else if(!await page.locator('.app-rail nav').getByRole('button',{name,exact:true}).isVisible()&&name==='Studio Persil')await page.getByRole('navigation',{name:'Jelajahi alur TIRTA'}).getByRole('button',{name:/Persil/}).click();
  else await page.locator('.app-rail nav').getByRole('button',{name,exact:true}).click();
}
for(const width of [1440,390])test(`roof degrees, provenance, correction and persistence at ${width}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.setViewportSize({width,height:width===390?844:900});await page.goto('/tirta.html');
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();await expect(page.locator('.view-studio')).toBeVisible();
  async function context(){
    if(!await page.locator('.view-studio').isVisible())await route(page,'Studio Persil');await page.getByRole('button',{name:'Pilih zona Gedung belajar',exact:true}).focus();await page.keyboard.press('Enter');
    if(width===390)await page.locator('.mobile-zone-summary').click();
    await page.getByRole('button',{name:'Kondisi permukaan & tujuan air',exact:true}).focus();await page.keyboard.press('Enter');
    const contextDialog=page.getByRole('dialog',{name:'Konteks Gedung belajar',exact:true});await expect(contextDialog).toBeVisible();return contextDialog;
  }
  async function closeMobile(){if(width===390)await page.getByLabel('Kembali ke sketsa',{exact:true}).click();}
  let dialog=await context();const pitch=dialog.getByLabel('Kemiringan atap',{exact:true});
  await expect(pitch).toHaveValue('');await expect(dialog.locator('select[name="roofPitchOrigin"]')).toHaveValue('unknown');
  await pitch.fill('30');await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('memerlukan sumber');
  await dialog.locator('select[name="roofPitchOrigin"]').selectOption('user_supplied');await dialog.locator('input[name="roofPitchSource"]').fill('Synthetic owner assumption');
  await pitch.fill('90');await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('alert')).toContainText('kurang dari 90');
  await pitch.fill('-1');await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();expect(await pitch.evaluate((el:HTMLInputElement)=>el.validity.rangeUnderflow)).toBe(true);await expect(dialog).toBeVisible();
  await pitch.fill('30');await dialog.locator('select[name="roofPitchOrigin"]').selectOption('measured');await dialog.locator('input[name="roofPitchMethod"]').fill('Synthetic inclinometer');await dialog.locator('input[name="roofPitchDate"]').fill('2026-10-05');
  await expect(dialog.getByRole('button',{name:'Simpan konteks',exact:true})).toBeInViewport();
  await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/context-${width}.png`});
  await dialog.getByRole('button',{name:'Dasar ilmiah',exact:true}).click();const source=page.getByRole('dialog',{name:'Mengapa data ini diperlukan?',exact:true});
  await source.locator('.evidence-record').first().locator('summary').click();await expect(source).toContainText('NSW Government');await expect(source).toContainText('bidang horizontal');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:`${folder}/source-${width}.png`});await page.keyboard.press('Escape');
  await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();await closeMobile();
  await route(page,'Hujan & kondisi awal');await expect(page.locator('.rain-equation')).toContainText('10 m³');await expect(page.locator('.rain-split')).toContainText('6,27');
  if(!await page.locator('.project-actions > summary').isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Simpan',exact:true}).click();await expect(page.locator('.project-menu-status')).toContainText('Tersimpan');await page.reload();
  await page.getByRole('button',{name:'Lanjutkan dari sini',exact:true}).click();await page.waitForURL('**?view=studio');await expect(page.locator('.view-studio')).toBeVisible();dialog=await context();
  await expect(dialog.getByLabel('Kemiringan atap',{exact:true})).toHaveValue('30');await expect(dialog.locator('input[name="roofPitchMethod"]')).toHaveValue('Synthetic inclinometer');
  await dialog.getByLabel('Kemiringan atap',{exact:true}).fill('0');await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();await closeMobile();
  await route(page,'Proyek');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Unduh cadangan proyek',exact:true}).click()]);
  const exported=JSON.parse(await readFile((await download.path())!,'utf8'));expect(exported.project.science.surfaces.z0.roof.pitch).toMatchObject({value:0,unit:'degrees',origin:'measured',method:'Synthetic inclinometer',date:'2026-10-05'});
  dialog=await context();await dialog.getByLabel('Kemiringan atap',{exact:true}).fill('');await dialog.locator('select[name="roofPitchOrigin"]').selectOption('unknown');await dialog.getByRole('button',{name:'Simpan konteks',exact:true}).click();await closeMobile();
  dialog=await context();await expect(dialog.getByLabel('Kemiringan atap',{exact:true})).toHaveValue('');await expect(dialog.locator('select[name="roofPitchOrigin"]')).toHaveValue('unknown');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await expect(dialog.getByRole('button',{name:'Simpan konteks',exact:true})).toBeInViewport();expect(errors).toEqual([]);
});
