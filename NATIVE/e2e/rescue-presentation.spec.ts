import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {hypotheticalSchool,partialActualPilot} from '../src/test/schoolCampaignFixtures';
import {projectBackup} from '../src/persistence/portable';
import {evaluatePlan} from '../src/domain/planningEngine';
import type {ProjectV2} from '../src/domain/projectV2';
const out='E:/CodexStore/home/audits/tirta-rescue-2026-10-07/presentation';
test.beforeEach(({page})=>page.setDefaultTimeout(15000));
async function nav(page:Page,name:string){
 const mobile=page.getByLabel('Ruang kerja',{exact:true});if(await mobile.isVisible()){await mobile.selectOption({label:name});return;}
 const b=page.locator('.app-rail nav').getByRole('button',{name,exact:true,includeHidden:true});
 for(const d of await b.locator('xpath=ancestor::details').all())await d.evaluate(el=>(el as HTMLDetailsElement).open=true);
 await b.click();
}
async function importFixture(page:Page,p:ProjectV2){await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'presentation.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});await expect(page.locator('.view-studio')).toBeVisible();}

test('partial real-pilot record asks for geometry rather than producing numbers',async({page})=>{
 await mkdir(out,{recursive:true});await importFixture(page,partialActualPilot());
 await expect(page.getByLabel('Panjang persil',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Tanya TIRTA',exact:true}).click();
 await expect(page.getByRole('region',{name:'Panduan kondisi lokasi'})).toContainText('Pilih sumber air');
 await expect(page.locator('.assistant-package-result')).toHaveCount(0);
 await page.screenshot({path:out+'/actual-pilot-no-fabricated-result.png',fullPage:true});
});

test('hypothetical school retains the unknown soil option but selects, exports and restores a supported tank',async({page,context})=>{
 test.setTimeout(180000);await mkdir(out,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const p=hypotheticalSchool();await importFixture(page,p);await page.screenshot({path:out+'/01-hypothetical-parcel.png',fullPage:true});
 await nav(page,'Intervensi');await page.getByRole('button',{name:'Tanya TIRTA',exact:true}).click();
 await page.getByLabel('Pertanyaan Anda',{exact:true}).fill('Bagaimana rain garden?');await page.getByRole('button',{name:'Kirim pertanyaan',exact:true}).click();
 await expect(page.locator('[data-guidance="rain-garden"]')).toContainText(/tanah|infiltrasi/);
 await page.screenshot({path:out+'/02-soil-question.png',fullPage:true});
 // The chosen plan can omit the unsupported draft; it is not auto-completed.
 await page.getByRole('button',{name:'Tanya TIRTA',exact:true}).click();await nav(page,'Alternatif');
 const row=page.locator('.comparison-row').filter({hasText:'Tangki'}).first();await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Pilih rencana ini',exact:false}).click();
 await expect(page.locator('.plan-water-flow:visible')).toContainText('3,72');
 await expect(page.locator('.plan-scenario-compact:visible')).not.toContainText('Belum dapat dinilai');
 await page.screenshot({path:out+'/03-selected-tank.png',fullPage:true});
 await page.getByRole('button',{name:'Unduh / ekspor',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Bagikan hasil',exact:true});await expect(dialog).toBeVisible();
 const [pdf]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Unduh PDF',exact:true}).click()]);await pdf.saveAs(out+'/hypothetical-school-summary.pdf');
 const [backup]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);await backup.saveAs(out+'/hypothetical-school-selected.tirta.json');
 const saved=(JSON.parse(await readFile((await backup.path())!,'utf8')) as {project:ProjectV2}).project;
 expect(saved.selectedPlan!.definition.components.filter(c=>c.enabled).map(c=>c.id)).toEqual(['tank']);
 const before=evaluatePlan(saved,saved.selectedPlan!.definition,'r50');expect(before.ok).toBe(true);
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await context.setOffline(true);await page.reload();await page.locator('.local-projects > summary').click();
 await page.locator('.open-project').filter({hasText:p.name}).first().click();await nav(page,'Rencana & Dampak');
 await expect(page.locator('.plan-water-flow:visible')).toContainText('3,72');
 await context.setOffline(false);await page.getByRole('button',{name:'TIRTA, buka proyek',exact:true}).click();
 await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles(out+'/hypothetical-school-selected.tirta.json');
 await nav(page,'Rencana & Dampak');await expect(page.locator('.plan-water-flow:visible')).toContainText('3,72');
 await page.screenshot({path:out+'/04-restored-result.png',fullPage:true});
 await writeFile(out+'/acceptance-result.json',JSON.stringify({kind:'hypothetical software case',raw:before,errors},null,2));expect(errors).toEqual([]);
});

for(const width of [1440,390])test('first-time clean project completes a roof and tank with optional nominal capacity left empty at '+width,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height:width===390?844:900});await page.goto('/tirta.html');await page.getByLabel('Nama proyek',{exact:true}).fill('Contoh hipotetis dari awal');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
 await page.getByLabel('Panjang persil',{exact:true}).fill('15');await page.getByLabel('Lebar persil',{exact:true}).fill('10');await page.getByRole('button',{name:'Buat persil',exact:true}).click();
 await page.getByRole('button',{name:width===390?'Tambah zona':'Zona',exact:true}).click();await page.getByRole('button',{name:'Seluruh persil',exact:true}).click();
 if(width===390)await page.locator('.mobile-zone-summary').click();await page.getByLabel('Jenis permukaan',{exact:true}).selectOption('roof');await page.locator('.coefficient-launch').click();
 const picker=page.getByRole('dialog',{name:'Pilih dari patokan',exact:true});await picker.getByRole('button',{name:'Isi custom',exact:true}).click();
 await picker.getByLabel('Koefisien untuk perhitungan',{exact:true}).fill('0.85');await picker.getByLabel('Sumber koefisien',{exact:true}).fill('Asumsi contoh hipotetis; bukan survei sekolah');await picker.getByRole('button',{name:'Terapkan',exact:true}).click();if(width===390)await page.keyboard.press('Escape');
 await nav(page,'Hujan & kondisi awal');await page.getByRole('group',{name:'Contoh hujan untuk pengujian'}).getByRole('button',{name:'50 mm',exact:true}).click();await expect(page.locator('.runoff-reading strong')).toContainText('6,38');
 await nav(page,'Intervensi');await page.getByRole('button',{name:'Tambahkan Tangki',exact:true}).click();const form=page.locator('.treatment-composer');
 if(await form.getByRole('button',{name:'Pilih sumber limpasan',exact:true}).isVisible()){await form.getByRole('button',{name:'Pilih sumber limpasan',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Zona 1/}).click();}
 await form.getByRole('button',{name:'Belum dipilih',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Zona 1/}).click();
 await form.getByRole('combobox',{name:'Jalur penyaluran',exact:true}).selectOption('gutter-downpipe');await form.getByLabel('Luas sumber sesuai area yang dilayani jalur ini',{exact:true}).check();await form.getByLabel('Dasar rencana penyaluran',{exact:true}).fill('Talang untuk seluruh atap pada contoh hipotetis');await form.getByRole('button',{name:'Simpan & lanjut',exact:true}).click();
 await form.getByLabel('Tampungan tersedia per kejadian (m³/event)',{exact:true}).fill('2');await form.getByRole('combobox',{name:'Dasar kinerja',exact:true}).selectOption('user-entered');await form.getByRole('button',{name:'Simpan & lanjut',exact:true}).click();
 await form.getByLabel('Biaya (Rp)',{exact:true}).fill('1000000');await form.getByLabel('Ruang terpakai (m²)',{exact:true}).fill('1');await form.getByRole('button',{name:'Simpan penanganan',exact:false}).click();
 await expect(page.locator('.notice')).toContainText('tersimpan');await expect(page.locator('.intervention-water-ledger')).toContainText('2 m³');
 await page.getByRole('button',{name:'Ubah batas',exact:true}).click();await page.getByLabel('Anggaran (Rp)',{exact:true}).fill('2000000');await page.getByLabel('Lahan tersedia (m²)',{exact:true}).fill('2');await page.getByRole('button',{name:'Terapkan batas rencana',exact:true}).click();await expect(page.locator('.limits-saved')).toContainText('Tersimpan');await page.keyboard.press('Escape');
 await nav(page,'Alternatif');if(width===390){await page.getByRole('button',{name:'Angka & pilihan',exact:true}).click();await page.locator('.compare-mobile-switch').getByRole('button',{name:'Alternatif 2',exact:true}).click();}await page.locator('.comparison-row').filter({hasText:'Tangki'}).getByRole('button',{name:'Pilih rencana ini',exact:false}).click();await expect(page.locator('.plan-water-flow:visible')).toContainText('4,38');
 await mkdir(out,{recursive:true});await page.screenshot({path:out+'/05-clean-user-created-result-'+width+'.png',fullPage:true});
});
