import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
const out='evidence/uiux-candidate/presentation';
async function route(page:Page,name:string){
  const mobile=page.getByLabel('Ruang kerja',{exact:true});
  if(await mobile.isVisible()) await mobile.selectOption({label:name});
  else {const b=page.locator('.app-rail nav').getByRole('button',{name,exact:true,includeHidden:true});for(const d of await b.locator('xpath=ancestor::details').all())if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();await b.click();}
}
async function reveal(field:Locator){for(const d of await field.locator('xpath=ancestor::details').all())if(await d.getAttribute('open')===null)await d.locator(':scope > summary').click();}
async function overflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);}
async function shot(page:Page,name:string){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/${name}.png`,fullPage:true});}
const runtimeErrors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const errors:string[]=[];runtimeErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});});
test.afterEach(({page})=>expect(runtimeErrors.get(page)).toEqual([]));

for(const width of [1440,390])test(`configure first, optional symbol, biopori reset and contextual help at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:900});
  await page.goto('/tirta.html');await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();await route(page,'Intervensi');
  for(const name of ['Tangki','Sumur / area resapan','Rain garden','Biopori']){
    await page.getByRole('button',{name:`Tambahkan ${name}`,exact:true}).click();
    await expect(page.locator('.placement-cue')).toHaveCount(0);
    await expect(page.locator('.active-intervention-editor form')).toHaveCount(1);
    await expect(page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Tutup',exact:true})})).toHaveCount(0);
    await overflow(page);
  }
  await page.locator('[data-component="soak-2"] .instance-select').click();
  const editor=page.locator('.active-intervention-editor');
  await editor.getByRole('button',{name:/Kapasitas/}).click();
  await editor.getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true}).fill('1');
  await editor.getByRole('button',{name:/Biaya & lahan/}).click();
  await editor.getByLabel('Biaya (Rp)',{exact:true}).fill('2.000.000'); await editor.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('4');
  await editor.getByRole('button',{name:'Simpan draft',exact:true}).click();
  await editor.getByRole('button',{name:/Hubungan/}).click();
  page.once('dialog', d => d.accept()); await editor.getByRole('combobox',{name:/Jenis resapan/}).selectOption('biopori');
  await editor.getByRole('button',{name:/Kapasitas/}).click();
  await expect(editor.getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true})).toHaveValue('');
  await editor.getByRole('button',{name:/Biaya & lahan/}).click();
  for(const label of ['Biaya (Rp)','Ruang terpakai (m²)']) await expect(editor.getByLabel(label,{exact:true})).toHaveValue('');
  await editor.getByRole('button',{name:/Kapasitas/}).click();
  await editor.getByRole('button',{name:'Dasar metode',exact:true}).click();
  const help=page.getByRole('dialog',{name:'Dasar TIRTA',exact:true});
  await expect(help.getByRole('heading',{name:'Biopori: kapan masuk akal?',exact:true})).toBeVisible();
  await help.getByText('Batas penerapan & sumber',{exact:true}).click();
  await help.getByRole('button',{name:'Bukti: biopori',exact:true}).click();
  const source=page.getByRole('dialog',{name:'Mengapa data ini diperlukan?',exact:true});
  await source.locator('.evidence-record > summary').click();await expect(source).toContainText('percobaan simulator hujan');
  await overflow(page);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await shot(page,`biopori-evidence-${width}`);
  await page.keyboard.press('Escape');await expect(help.getByRole('button',{name:'Bukti: biopori',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(editor.getByRole('button',{name:'Dasar metode',exact:true})).toBeFocused();
  await editor.getByRole('button',{name:'Simpan draft',exact:true}).click();
  await page.locator('[data-component="soak-2"] .instance-actions > summary').click();await page.locator('[data-component="soak-2"]').getByRole('button',{name:/Lepas/}).click();
  await page.locator('.deferred-treatments > summary').click(); await page.locator('.deferred-treatments button').filter({hasText:'Biopori'}).click();
  await page.locator('[data-component="soak-2"] .instance-select').click();
  await expect(editor.getByRole('combobox',{name:/Jenis resapan/})).toHaveValue('biopori');
  await shot(page,`intervention-configure-${width}`);
  await page.locator('[data-component="soak-2"] .instance-actions > summary').click();await page.locator('[data-component="soak-2"]').getByRole('button',{name:'Letakkan di persil',exact:true}).click();
  await expect(page.getByRole('button',{name:'Letakkan di tengah persil',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Letakkan di tengah persil',exact:true}).click();
  await editor.getByRole('button',{name:/Kapasitas/}).click();
  await expect(editor.getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true})).toHaveValue('');
  await overflow(page);
});

test('all four native drag images use only compact artwork',async({page})=>{
  await page.addInitScript(()=>{
    const original=DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage=function(element,x,y){
      (window as unknown as {ghosts:unknown[]}).ghosts??=[];
      (window as unknown as {ghosts:unknown[]}).ghosts.push({tag:element.tagName,width:(element as HTMLImageElement).width,height:(element as HTMLImageElement).height,text:element.textContent,x,y});
      return original.call(this,element,x,y);
    };
  });
  await page.goto('/tirta.html');await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();await route(page,'Intervensi');
  for(const name of ['Tangki','Sumur / area resapan','Rain garden','Biopori']){
    const button=page.getByRole('button',{name:`Tambahkan ${name}`,exact:true});await expect(button).toHaveAttribute('draggable','true');
    await button.dragTo(page.getByLabel('Persil dan zona Anda',{exact:true}),{targetPosition:{x:250,y:150}});
  }
  const ghosts=await page.evaluate(()=>(window as unknown as {ghosts:{tag:string;width:number;height:number;text:string;x:number;y:number}[]}).ghosts);
  expect(ghosts).toHaveLength(4);for(const ghost of ghosts){expect(ghost.tag).toBe('CANVAS');expect(ghost.text).toBe('');expect(Math.max(ghost.width,ghost.height)).toBeLessThanOrEqual(96);expect(ghost.x).toBeGreaterThan(0);}
  await shot(page,'optional-drag');
});

test('library exposes catalog editions without inventing standard thresholds',async({page})=>{
  await page.goto('/tirta.html');await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  await page.getByRole('button',{name:'Dasar TIRTA',exact:true}).click();await page.getByRole('button',{name:'Jelajahi seluruh referensi',exact:true}).click();
  const library=page.getByRole('dialog',{name:'Dasar ilmiah TIRTA',exact:true});await library.getByLabel('Cari referensi').fill('8456');
  await expect(library.locator('.scientific-references > li')).toHaveCount(2);
  await library.getByText('SNI 8456:2025 — Sumur dan parit resapan air hujan',{exact:true}).click();
  await expect(library).toContainText('Isi normatif belum ditinjau');await shot(page,'standard-catalog');
});

test('rain error recovery and browser history preserve project context',async({page})=>{
  await page.goto('/tirta.html');await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
  await route(page,'Hujan & kondisi awal');
  const rain=page.getByLabel('Kedalaman hujan',{exact:true}),apply=page.getByRole('button',{name:'Terapkan hujan & hitung ulang',exact:true});
  await rain.fill('-1');await apply.click();await expect(rain).toHaveAttribute('aria-invalid','true');await expect(page.locator('.rain-equation')).toContainText('10 m³');
  await page.getByRole('radio',{name:'Skenario uji saya',exact:true}).check();await rain.fill('60');await apply.click();await expect(page.locator('.rain-equation')).toContainText('12 m³');
  await page.getByRole('radio',{name:'Data / referensi hujan',exact:true}).check();await apply.click();await expect(page.getByLabel('Sumber hujan',{exact:true})).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Sumber hujan',{exact:true}).fill('Synthetic scenario reference; not a measured station event');await apply.click();await expect(rain).not.toHaveAttribute('aria-invalid','true');
  await route(page,'Intervensi');await page.goBack();await expect(page.getByRole('heading',{level:1})).toContainText('Hujan');await expect(rain).toHaveValue('60');
  await page.goForward();await expect(page.getByRole('heading',{level:1})).toHaveText('Rancang Penanganan');
  const tank=page.getByRole('button',{name:'Tambahkan Tangki',exact:true});await tank.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.treatment-composer')).toHaveCount(1);await expect(page.locator('.treatment-composer .role-choice').first()).toBeFocused();
  await page.goBack();await expect(rain).toHaveValue('60');await rain.fill('-2');await apply.click();await expect(page.locator('#rain-error')).toContainText('Input Anda belum diterapkan');await expect(page.locator('.rain-equation')).toContainText('12 m³');
  await rain.fill('0');await apply.click();await expect(page.locator('.rain-equation')).toContainText('0 m³');
  await page.setViewportSize({width:390,height:844});await overflow(page);await shot(page,'history-input-recovery-mobile');
});

test('presentation fixture is exported through the actual UI with live four-family results',async({page})=>{
  await page.goto('/tirta.html');const input=page.getByLabel('Buka berkas cadangan');await reveal(input);
  await input.setInputFiles({name:'declared-demo.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(setActiveComponents(demoProject(),['tank','soak','garden','porous'])))});await route(page,'Intervensi');
  await expect(page.locator('.composition-legend')).toContainText('0,36');await shot(page,'demo-interventions');
  await route(page,'Alternatif');await shot(page,'demo-alternatives');
  await page.getByRole('button',{name:'Kosongkan perbandingan',exact:true}).click();await page.getByLabel('Bandingkan Alternatif 16',{exact:true}).check();
  await page.locator('.compare-matrix .primary').click();await shot(page,'demo-plan');
  await page.getByRole('tab',{name:'Penjelasan lengkap',exact:true}).click();await shot(page,'demo-plan-detail');
  await route(page,'Proyek');await reveal(page.getByRole('button',{name:'Unduh cadangan proyek',exact:true}));
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Unduh cadangan proyek',exact:true}).click()]);
  await download.saveAs(`${out}/presentation-demo.tirta.json`);
  const fixture=JSON.parse(await readFile(`${out}/presentation-demo.tirta.json`,'utf8'));
  expect(fixture.project.zones).toHaveLength(5);expect(fixture.project.components.filter((c:{enabled:boolean})=>c.enabled)).toHaveLength(4);
  expect(JSON.stringify(fixture)).toMatch(/sintetis|synthetic/i);
});

test.describe('built production offline',()=>{
  test.use({serviceWorkers:'allow'});
  test('offline reload preserves the parcel; blank and zero rain stay distinct',async({page,context})=>{
    await page.goto('/tirta.html');await page.getByLabel('Nama proyek',{exact:true}).fill('Offline presentation proof');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
    await page.getByLabel('Panjang persil').fill('15');await page.getByLabel('Lebar persil').fill('10');await page.getByRole('button',{name:'Buat persil',exact:true}).click();await page.getByRole('button',{name:'Zona',exact:true}).click();await page.getByRole('button',{name:'Seluruh persil',exact:true}).click();await page.getByLabel('Jenis permukaan',{exact:true}).selectOption('roof');
    await page.locator('.coefficient-help').getByRole('button').click();await page.getByRole('button',{name:/Tengah rentang/}).click();await page.getByRole('button',{name:'Terapkan data zona',exact:true}).click();
    await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Simpan',exact:true}).click();await expect(page.locator('.save-state')).toContainText('Tersimpan');
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await context.setOffline(true);await page.reload();
    await page.locator('.local-projects > summary').click();await page.locator('.local-projects').getByRole('button',{name:/^Offline presentation proof/}).click();await route(page,'Hujan & kondisi awal');
    const input=page.getByLabel('Kedalaman hujan',{exact:true}),apply=page.getByRole('button',{name:'Terapkan hujan & hitung ulang',exact:true});
    await input.fill('60');await apply.click();await expect(page.locator('.rain-equation')).toContainText('9 m³');
    await input.fill('');await apply.click();await expect(page.locator('.rain-equation')).toHaveCount(0);
    await input.fill('0');await apply.click();await expect(page.locator('.rain-equation')).toContainText('0 m³');
    await shot(page,'offline-zero-rain');await context.setOffline(false);
  });
});

test('field comparison cannot label dry or reversed events improved; records survive reload',async({page})=>{
  await page.goto('/tirta.html');const input=page.getByLabel('Buka berkas cadangan');await reveal(input);
  await input.setInputFiles('evidence/uiux-candidate/fixtures/density-alternatives.tirta.json');await expect(page.getByRole('heading',{name:'Studio Persil',exact:true})).toBeVisible();await route(page,'Alternatif');
  await page.getByRole('button',{name:'Kosongkan perbandingan',exact:true}).click();await page.getByLabel('Bandingkan Alternatif 16',{exact:true}).check();await page.locator('.compare-matrix .primary').click();
  await page.getByRole('tab',{name:'Langkah lapangan',exact:true}).click();await page.getByRole('button',{name:'Catat sebelum & sesudah',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pengamatan lapangan',exact:true});
  async function event(part:string,date:string,rain:string,ponding:string){
    await dialog.getByRole('button',{name:part,exact:true}).click();await dialog.locator('input[name="eventDate"]').fill(date);
    await dialog.locator('input[name="eventRain"]').fill(rain);await dialog.locator('select[name="eventRainOrigin"]').selectOption('user_supplied');await dialog.locator('input[name="eventRainSource"]').fill('Synthetic presentation test, not a site measurement');await dialog.locator('select[name="ponding"]').selectOption(ponding);await dialog.getByRole('button',{name:'Simpan catatan',exact:true}).click();
  }
  await event('Sebelum','2026-09-01','60','observed');await event('Sesudah','2026-09-02','0','not-observed');
  await dialog.getByRole('button',{name:'Pemasangan & konteks',exact:true}).click();await dialog.locator('select[name="comparable"]').selectOption('yes');await dialog.locator('input[name="comparisonBasis"]').fill('Synthetic comparable context');await dialog.locator('select[name="installed"]').selectOption('yes');await dialog.locator('input[name="installationNote"]').fill('Synthetic declaration');await dialog.getByRole('button',{name:'Simpan catatan',exact:true}).click();
  await expect(dialog).toContainText('tanpa hujan tidak dapat menunjukkan perbaikan');await shot(page,'field-zero-rain');
  await event('Sesudah','2026-08-31','60','not-observed');await expect(dialog).toContainText('Tanggal sesudah tidak boleh mendahului');
  await event('Sesudah','2026-09-01','60','not-observed');await expect(dialog).toContainText('Tanggal sesudah harus lebih akhir');
  await page.setViewportSize({width:390,height:844});await overflow(page);await expect(dialog.getByRole('button',{name:'Simpan catatan',exact:true})).toBeInViewport();await shot(page,'field-chronology-mobile');
  await event('Sesudah','2026-09-02','60','not-observed');await expect(dialog).toContainText('Ada indikasi membaik');
  await event('Sesudah','2026-09-02','','not-observed');await expect(dialog).toContainText('Data belum cukup');
  await event('Sesudah','2026-09-02','60','not-observed');await page.keyboard.press('Escape');
  await page.locator('.project-actions > summary').click();await page.getByRole('button',{name:'Simpan',exact:true}).click();await page.reload();
  await page.locator('.local-projects > summary').click();await page.locator('.local-projects').getByRole('button',{name:/^Synthetic alternatives/}).first().click();await route(page,'Rencana & Dampak');await page.getByRole('tab',{name:'Langkah lapangan',exact:true}).click();await expect(page.locator('.field-evaluation')).toContainText('Ada indikasi membaik');
});
