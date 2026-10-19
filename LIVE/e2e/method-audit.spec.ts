import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
const dir='evidence/uiux-candidate/method-audit';
async function go(page:Page,name:string){
  const mobile=page.getByLabel('Ruang kerja',{exact:true});
  if(await mobile.isVisible()) await mobile.selectOption({label:name});
  else {if(['Alternatif','Bandingkan'].includes(name))await page.locator('.comparison-navigation > summary').click();await page.locator('.app-rail nav').getByRole('button',{name,exact:true}).click();}
}
for(const width of [1440,1366,390])test(`method provenance, conversion boundaries and disclosure at ${width}px`,async({page})=>{
  await mkdir(dir,{recursive:true});await page.setViewportSize({width,height:width===390?844:width===1366?768:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  await page.goto('/tirta.html');await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();await go(page,'Intervensi');
  for(const name of ['Tangki','Sumur / area resapan','Rain garden','Permukaan berpori'])await page.getByRole('button',{name:`Tambahkan ${name}`,exact:true}).click();
  const target=page.getByLabel('Zona yang diganti',{exact:true});
  await expect(target.locator('option[value="z0"]')).toBeDisabled();await expect(target.locator('option[value="z1"]')).toBeEnabled();
  await expect(target.locator('option[value="z2"]')).toBeDisabled();await expect(target.locator('option[value="z3"]')).toBeDisabled();await expect(target.locator('option[value="z4"]')).toBeDisabled();
  await page.locator('.active-intervention-editor').getByRole('button',{name:/tinjau dasar/}).click();
  await expect(page.getByRole('dialog').getByLabel('Dasar kinerja dan batas penerapannya',{exact:true})).toHaveAttribute('placeholder','Belum diketahui');
  await page.getByRole('button',{name:'Bagaimana memahami kapasitas ini?'}).click();
  const help=page.getByRole('dialog',{name:'Dasar TIRTA',exact:true});await expect(help.getByRole('heading',{name:'Mengganti perkerasan',exact:true})).toBeVisible();
  await expect(help.getByText('Batas penerapan & sumber', {exact:true})).toBeVisible();
  for(const method of ['surface','duration','storage','infiltration','garden','allocation','resources','pareto','impact']){
    await help.getByLabel('Langkah yang ingin dipahami').selectOption(method);
    await expect(help.getByRole('heading',{name:'Data yang dibutuhkan',exact:true})).toBeVisible();
    await expect(help.getByRole('heading',{name:'Apa artinya bagi rencana saya?',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
  await help.getByLabel('Langkah yang ingin dipahami').selectOption('permeable');
  await help.getByText('Batas penerapan & sumber',{exact:true}).click();
  await expect(help).toContainText('underdrain');
  await help.getByRole('button',{name:'Bukti: perkerasan berpori',exact:true}).click();
  const sources=page.getByRole('dialog',{name:'Mengapa data ini diperlukan?',exact:true});
  await sources.locator('.evidence-record > summary').first().click();await expect(sources).toContainText('Konteks studi:');await expect(sources).toContainText('bukan seluruh teks');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:`${dir}/source-${width}.png`});await page.keyboard.press('Escape');
  await page.screenshot({path:`${dir}/methods-${width}.png`});await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Bagaimana memahami kapasitas ini?'})).toBeFocused();await page.keyboard.press('Escape');
  await go(page,'Alternatif');expect(await page.locator('.compare-candidate').count()).toBeGreaterThan(0);await go(page,'Bandingkan');
  if(width===390){await page.getByRole('button',{name:'Angka & pilihan',exact:true}).click();await page.locator('.compare-mobile-switch button').nth(1).click();}
  await page.locator('.comparison-row').getByRole('button',{name:/periksa/}).first().click();
  const screening=page.getByRole('dialog');await screening.getByText('Urutan neraca & sumber air',{exact:true}).click();await expect(screening).toContainText('bukan hasil simulasi hidraulik');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.screenshot({path:`${dir}/allocation-${width}.png`});expect(errors).toEqual([]);
});
