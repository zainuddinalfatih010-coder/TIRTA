import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
const folder='evidence/uiux-candidate/landing';
test.beforeEach(async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  (page as typeof page & {landingErrors:string[]}).landingErrors=errors;
  await mkdir(folder,{recursive:true});
  await page.goto('/tirta.html');
  await page.evaluate(()=>document.fonts.ready);
});
test.afterEach(async({page})=>expect((page as typeof page & {landingErrors:string[]}).landingErrors).toEqual([]));

test('live example changes rainfall and composition without creating or changing a real project',async({page})=>{
  const result=page.locator('.landing-water-result');
  await expect(result).toContainText('6,27'); await expect(result).toContainText('0,42');
  await page.getByRole('button',{name:'100 mm',exact:true}).click();
  await expect(result).toContainText('12,54');
  const changed=await result.innerText(); expect(changed).not.toContain('Sisa limpasan\n0,42');
  await page.getByRole('button',{name:'Tanpa intervensi',exact:true}).click();
  await expect(result.locator('dd').last()).toHaveText('12,54 m³');
  await page.getByRole('button',{name:'50 mm',exact:true}).click();
  await expect(result.locator('dd').last()).toHaveText('6,27 m³');
  await expect(page.locator('.local-projects > summary')).toHaveText('Proyek tersimpan (0)');
  await expect(page.locator('.local-project-menu')).toBeHidden();
  await page.getByRole('button',{name:'Dengan 3 intervensi',exact:true}).click();
  // Wait for the live chart transition, and prove its rendered proportions match the ledger.
  await expect.poll(()=>page.locator('.landing-volume-bar').evaluate(el=>el.children[0]!.getBoundingClientRect().width/el.getBoundingClientRect().width)).toBeCloseTo(2.55/6.27,3);
  await expect.poll(()=>page.locator('.landing-volume-bar').evaluate(el=>el.children[2]!.getBoundingClientRect().width/el.getBoundingClientRect().width)).toBeCloseTo(.42/6.27,3);
  await page.screenshot({path:`${folder}/desktop.png`,fullPage:true});
  await expect(page.getByRole('button',{name:'Buat proyek baru',exact:true})).toBeInViewport();
  expect(await page.locator('.landing-journey').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
  const axe=await new AxeBuilder({page}).include('.project-landing').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('empty project creation retains validation and exact-field recovery',async({page})=>{
  await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
  await expect(page.getByLabel('Nama proyek',{exact:true})).toHaveValue('');
  await page.getByLabel('Nama proyek',{exact:true}).fill('Lahan baru — bukan contoh');
  await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await expect(page.locator('.parcel-svg polygon[data-zone]')).toHaveCount(0);
  await page.getByRole('button',{name:'Hujan & kondisi awal',exact:true}).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await expect(page.getByRole('region',{name:'Kelengkapan untuk melanjutkan',exact:true})).toBeVisible();
});

test('project library stays bounded, searchable, opens, deletes and reloads long names',async({page})=>{
  const names=Array.from({length:12},(_,i)=>`Lahan ${String(i+1).padStart(2,'0')} — Bangunan sekolah dengan area halaman dan vegetasi yang namanya sangat panjang`);
  for(const name of names){
    await page.getByLabel('Nama proyek',{exact:true}).fill(name);
    await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
    await expect(page.locator('.view-studio')).toBeVisible();
    await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  }
  await expect(page.locator('.local-project-row')).toHaveCount(12);
  await expect(page.locator('.local-projects')).not.toHaveAttribute('open');
  await page.locator('.local-projects > summary').click();
  const scroll=page.getByRole('region',{name:'Daftar proyek tersimpan'});
  expect(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight && el.clientHeight<=285)).toBe(true);
  await scroll.scrollIntoViewIfNeeded(); await scroll.hover(); await page.mouse.wheel(0,700);
  await expect(scroll.locator('.local-project-row').last()).toBeInViewport();
  await page.getByLabel('Cari proyek tersimpan').fill('Lahan 08');
  await expect(page.locator('.local-project-row')).toHaveCount(1);
  await page.locator('.open-project').click(); await expect(page.locator('.view-studio')).toBeVisible();
  await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  await page.locator('.local-projects > summary').click();
  await page.getByLabel('Cari proyek tersimpan').fill('Lahan 08');
  await page.locator('.delete-project').click();
  await page.getByRole('button',{name:'Ya, hapus proyek',exact:true}).click();
  await expect(page.getByText('Tidak ada proyek dengan nama itu.')).toBeVisible();
  await page.getByLabel('Cari proyek tersimpan').fill('');
  await expect(page.locator('.local-project-row')).toHaveCount(11);
  await page.reload(); await expect(page.locator('.local-project-row')).toHaveCount(11);
  await expect(page.locator('.local-project-menu')).toBeHidden();
  await page.locator('.local-projects > summary').click();
  await page.screenshot({path:`${folder}/saved-projects-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const menu=page.locator('.local-project-menu');
  await expect.poll(async()=>{const b=await menu.boundingBox();return b!==null&&b.x>=0&&b.y>=0&&b.x+b.width<=390&&b.y+b.height<=844;}).toBe(true);
  await page.screenshot({path:`${folder}/saved-projects-mobile.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('mobile example, help and creation remain readable and operable',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'100 mm',exact:true}).click();
  await expect(page.locator('.landing-water-result')).toContainText('12,54');
  await page.getByRole('button',{name:'Dasar neraca contoh',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Menangani air');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({path:`${folder}/mobile.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const axe=await new AxeBuilder({page}).include('.project-landing').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze(); expect(axe.violations).toEqual([]);
  await page.getByLabel('Nama proyek',{exact:true}).fill('Rumah uji mobile');
  await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click(); await expect(page.locator('.view-studio')).toBeVisible();
});

test('laptop, tablet and small mobile do not overflow or clip primary actions',async({page})=>{
  for(const [width,height] of [[1366,650],[1366,768],[1536,864],[1920,1080],[768,1024],[320,740]] as const){
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}x${height}`).toBe(true);
    const button=page.getByRole('button',{name:'Buat proyek baru',exact:true}); await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
    await page.getByRole('button',{name:'100 mm',exact:true}).click(); await expect(page.locator('.landing-water-result')).toContainText('12,54');
    if(width===1366) {await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${folder}/laptop-${height}.png`,fullPage:true});}
  }
});

test('both canonical example entry points still open editable projects',async({page})=>{
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await expect(page.locator('.zone-register .zone-row')).toHaveCount(5);
  await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  await page.getByRole('button',{name:'Contoh: data lapangan belum lengkap',exact:true}).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await expect(page.locator('.zone-register .zone-row')).toHaveCount(5);
});

test('project popup does not move the example, supports keyboard and stays inside short viewports',async({page})=>{
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  const disclosure=page.locator('.local-projects');
  const trigger=disclosure.locator(':scope > summary');
  const menu=page.locator('.local-project-menu');
  for(const [width,height] of [[1440,900],[1366,650],[1920,1080],[390,844],[320,740]] as const){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    await expect(page.getByRole('button',{name:'Unduh cadangan proyek',exact:true})).toBeEnabled();
    const before=await page.locator('.landing-example').boundingBox();
    await trigger.focus();await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await expect.poll(async()=>{const b=await menu.boundingBox();return b!==null&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height;}).toBe(true);
    const after=await page.locator('.landing-example').boundingBox();
    expect(after?.y).toBeCloseTo(before!.y,0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const axe=await new AxeBuilder({page}).include('.project-landing').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
    await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(trigger).toBeFocused();
    await trigger.click();await page.locator('#landing-title').click();await expect(menu).toBeHidden();
  }
});

test('hero backup controls download the active project and open a separate imported project',async({page})=>{
  const downloadButton=page.getByRole('button',{name:'Unduh cadangan proyek',exact:true});
  await expect(downloadButton).toBeDisabled();await expect(downloadButton).toBeInViewport();
  await expect(page.locator('.backup-import')).toBeInViewport();
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),downloadButton.click()]);
  expect(download.suggestedFilename()).toBe('TIRTA-proyek.tirta.json');
  const file=(await download.path())!;
  const backup=JSON.parse(await readFile(file,'utf8')) as {project:{id:string;zones:unknown[];parameters:unknown[]}};
  expect(backup.project.zones).toHaveLength(5);expect(backup.project.parameters.length).toBeGreaterThan(0);
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByLabel('Buka berkas cadangan',{exact:true}).focus().then(()=>page.keyboard.press('Enter'))]);
  await chooser.setFiles(file);await expect(page.locator('.view-studio')).toBeVisible();
  await expect(page.locator('.zone-row')).toHaveCount(5);
  await page.getByRole('button',{name:'Hujan & kondisi awal',exact:true}).click();
  await expect(page.locator('.view-rain')).toContainText('6,27');
  await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
  await expect(page.locator('.local-project-row')).toHaveCount(2);
  await page.locator('.local-projects > summary').click();
  const openButtons=page.locator('.open-project');expect(await openButtons.count()).toBe(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.local-project-menu')).toBeHidden();
  const [chooserAgain]=await Promise.all([page.waitForEvent('filechooser'),page.locator('.backup-import').click()]);
  await chooserAgain.setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad json')});
  await expect(page.locator('.notice')).toBeVisible();await expect(page.locator('.local-project-row')).toHaveCount(2);
});
