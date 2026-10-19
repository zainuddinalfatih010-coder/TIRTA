import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { addTreatment } from '../src/domain/treatmentDesign';
import type { ProjectV2 } from '../src/domain/projectV2';
import { createProjectV2 } from '../src/domain/projectV2';
import { addShape, updateShapeData } from '../src/domain/authoring';
import { emptySurfaceContext } from '../src/domain/scientificContract';
import { saveRain } from '../src/domain/planningAuthoring';
test.use({ actionTimeout: 10000 });
const folder = 'evidence/uiux-candidate/treatment';
async function route(page: Page, name: string) {
  const mobile = page.getByLabel('Ruang kerja', { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else { const button = page.locator('.app-rail nav').getByRole('button', { name, exact: true, includeHidden: true }); for (const d of await button.locator('xpath=ancestor::details').all()) if (!await d.getAttribute('open')) await d.locator(':scope > summary').click(); await button.click(); }
}
async function open(page: Page, p: ProjectV2) {
  await page.goto('/tirta.html');
  const file = page.getByLabel('Buka berkas cadangan');
  for (const d of await file.locator('xpath=ancestor::details').all()) if (!await d.getAttribute('open')) await d.locator(':scope > summary').click();
  await file.setInputFiles({ name: 'treatment-test.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(p)) });
  await expect(page.getByRole('heading', { name: 'Studio Persil', exact: true })).toBeVisible();
  await route(page, 'Intervensi');
  const notice = page.getByRole('button', { name: 'Tutup pemberitahuan' }); if (await notice.isVisible()) await notice.click();
}
async function shot(page: Page, name: string) { await mkdir(folder, { recursive: true }); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true }); }
const editor = (page: Page) => page.locator('.treatment-composer');
async function choose(page: Page, button: string, zone: string) { await editor(page).getByRole('button', { name: button, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: new RegExp(zone) }).click(); }
function emptyTreatments() { return setActiveComponents(demoProject(), []); }
async function source(page: Page, zone = 'Gedung belajar') { await choose(page, 'Pilih sumber limpasan', zone); await editor(page).getByLabel('Jalur penyaluran').selectOption('gutter-downpipe'); await editor(page).getByLabel('Luas sumber sesuai area yang dilayani jalur ini').check(); await editor(page).getByLabel('Dasar rencana penyaluran').fill('Rencana user: talang tersambung pada inlet; perlu pemeriksaan lokasi.'); }
test('A: two roofs → tank, one large roof valid, draft optional cost, real water ledger, no duplicate source question', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const p = emptyTreatments(); p.zones.find(z => z.id === 'z1')!.surface = 'roof'; const record = p.classificationRecords.find(r => r.id === p.zones.find(z => z.id === 'z1')!.classificationRecordId)!; if (record.origin === 'demo') record.class = 'roof'; else record.confirmedClass = 'roof';
  await open(page, p);
  await page.getByRole('button', { name: 'Tambahkan Tangki', exact: true }).click();
  await source(page); await choose(page, 'Tambah sumber', 'Halaman kegiatan');
  await choose(page, 'Belum dipilih', 'Tanah timur');
  await editor(page).getByRole('button', { name: 'Simpan & lanjut', exact: true }).click();
  await editor(page).getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact: true }).fill('2');
  await editor(page).getByRole('combobox', { name: 'Dasar kinerja', exact: true }).selectOption('user-entered');
  await editor(page).getByLabel('Alasan dan batas penerapan').fill('Asumsi kapasitas untuk satu kejadian; belum pengukuran.');
  await editor(page).getByLabel('Kapasitas nominal tangki (m³)').fill('3');
  await editor(page).getByLabel('Dasar ukuran tangki').fill('Rencana tangki 3 m³');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await expect(page.locator('.intervention-water-ledger')).toContainText('2 m³');
  await expect(page.locator('.event-only-note')).toContainText('belum memenuhi');
  await editor(page).getByRole('button', { name: /tinjau dasar/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('[name="performanceSource"]').fill('DRAFT TIDAK BOLEH HILANG');
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await dialog.getByRole('button', { name: 'Dasar kapasitas', exact: true }).click();
  await expect(dialog.locator('[name="performanceSource"]')).toHaveValue('DRAFT TIDAK BOLEH HILANG');
  await dialog.getByRole('button', { name: 'Sumber & luapan', exact: true }).click();
  await expect(dialog.locator('input[type="checkbox"][name="connected"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(editor(page).getByRole('status')).toContainText('Draft tersimpan');
  await shot(page, 'desktop-two-roof-tank');
  await page.locator('.project-actions > summary').click(); await page.getByRole('button', { name: 'Simpan', exact: true }).click(); await expect(page.locator('.save-state')).toContainText('Tersimpan');
  await page.reload(); await page.locator('.local-projects > summary').click(); await page.locator('.local-projects button').filter({ hasText: p.name }).first().click(); await route(page, 'Intervensi');
  await page.locator('.instance-select').filter({ hasText: 'Tangki 2' }).click();
  await expect(editor(page)).toContainText('Gedung belajar + Halaman kegiatan');
  const axe = await new AxeBuilder({ page }).include('.treatment-composer').analyze(); expect(axe.violations.filter(x => x.impact === 'critical' || x.impact === 'serious')).toEqual([]);
  expect(errors).toEqual([]);
});
test('B/C/D/E: conversion vs source/site, biopori UNKNOWN, shared source warns and parallel has no benefit', async ({ page }) => {
  await open(page, emptyTreatments());
  await page.locator('.deferred-treatments > summary').click(); await page.locator('.deferred-treatments button').filter({hasText:'Permukaan berpori'}).click();
  await choose(page, 'Pilih permukaan', 'Halaman kegiatan');
  await editor(page).getByRole('button', { name: 'Pilih permukaan', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('Paving berpori');
  await page.keyboard.press('Escape');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await page.getByRole('button', { name: 'Tambahkan Rain garden', exact: true }).click(); await source(page); await choose(page, 'Belum dipilih', 'Taman');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await expect(editor(page)).toContainText('pada Taman');
  await page.locator('.biopori-entry').click(); await source(page); await choose(page, 'Belum dipilih', 'Tanah timur');
  await expect(editor(page)).toContainText('Sumber ini juga dipilih');
  await editor(page).getByLabel('Bagaimana kedua pilihan digunakan?').selectOption('parallel');
  await editor(page).getByRole('button', { name: 'Simpan & lanjut', exact: true }).click();
  await editor(page).locator('[name="holeCount"]').fill('10'); await editor(page).locator('[name="holeDiameter"]').fill('10'); await editor(page).locator('[name="holeDepth"]').fill('60'); await editor(page).locator('[name="holeSource"]').fill('Draft geometri lubang pengguna; bukan desain konstruksi.');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await expect(page.locator('.intervention-water-ledger')).toContainText('Dampak belum dapat dihitung');
  await expect(editor(page).getByLabel('Air yang dapat diresapkan (m³/event)', { exact: true })).toHaveValue('');
  await shot(page, 'biopori-unknown-shared-source');
});
test('F: mobile keyboard/list roles, retained draft and reachable actions without drag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, emptyTreatments()); await page.getByRole('button', { name: 'Tambahkan Tangki', exact: true }).click();
  await editor(page).getByRole('button', { name: 'Pilih sumber limpasan', exact: true }).click();
  await page.getByRole('dialog').getByRole('searchbox', { name: 'Cari zona' }).fill('Gedung');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(editor(page)).toContainText('Gedung belajar');
  await editor(page).getByLabel('Jalur penyaluran').selectOption('gutter-downpipe'); await editor(page).getByLabel('Luas sumber sesuai area yang dilayani jalur ini').check(); await editor(page).getByLabel('Dasar rencana penyaluran').fill('Draft mobile');
  await editor(page).getByRole('button', { name: 'Simpan & lanjut', exact: true }).click();
  await editor(page).getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact: true }).fill('1.5');
  await editor(page).getByRole('button', { name: /1Hubungan|Hubungan/ }).click();
  await editor(page).getByRole('button', { name: /Kapasitas/ }).click();
  await expect(editor(page).getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact: true })).toHaveValue('1.5');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).scrollIntoViewIfNeeded();
  await expect(editor(page).getByRole('button', { name: 'Simpan draft', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, 'mobile-composer');
});
test('stress: 20 long zones, 15 independent treatment drafts, compact navigator and searchable roles', async ({ page }) => {
  let p = createProjectV2('stress', 'Stress 20 zona dan 15 penanganan', new Date().toISOString());
  const shapeData = (name: string, area: number, surface: 'roof' | null) => ({ name, surface, area: { value: area, evidence: 'USER_INPUT' as const, source: 'Synthetic UI stress', note: '' }, coefficient: { value: surface ? .8 : null, evidence: surface ? 'USER_INPUT' as const : 'UNKNOWN' as const, source: surface ? 'Synthetic UI stress' : '', note: '' }, method: 'direct' as const, length: { value: null, evidence: 'UNKNOWN' as const, source: '', note: '' }, width: { value: null, evidence: 'UNKNOWN' as const, source: '', note: '' } });
  p = addShape(p, 'parcel', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }], true); p = updateShapeData(p, 'parcel', shapeData('', 200, null), () => crypto.randomUUID());
  for (let i = 0; i < 20; i++) { const x = i % 5 * 4, y = Math.floor(i / 5) * 2.5, id = `zone-${i}`; p = addShape(p, id, [{ x, y }, { x: x + 4, y }, { x: x + 4, y: y + 2.5 }, { x, y: y + 2.5 }]); p = updateShapeData(p, id, shapeData(`Atap gedung kegiatan pendidikan bagian timur sangat panjang ${i}`, 10, 'roof'), () => crypto.randomUUID()); }
  const sid = 'stress-rain'; p = saveRain(p, sid, 'Stress 60 mm', { text: '60', source: 'Synthetic stress rainfall', evidence: 'USER_INPUT' }, 'Stress');
  for (let i = 0; i < 15; i++) { const a = addTreatment(p, 'storage', sid, `zone-${i}`); p = a.project; p.components.find(c => c.id === a.id)!.name = `Tangki untuk bangunan dengan nama sangat panjang nomor ${i}`; }
  await open(page, p); await expect(page.locator('.intervention-instance-list .instance-select')).toHaveCount(15);
  await expect(page.locator('.active-intervention-editor .treatment-composer')).toHaveCount(1);
  await editor(page).getByRole('button', { name: 'Tambah sumber', exact: true }).click(); await page.getByRole('dialog').getByRole('searchbox', { name: 'Cari zona' }).fill('19'); await expect(page.getByRole('dialog').locator('.role-zone-list button')).toHaveCount(1); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await shot(page, 'stress-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await shot(page, 'stress-mobile');
});

for (const width of [1440, 390]) test(`fresh continuous 150m2 roof → 60mm → declared tank → comparison → chosen plan at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await page.goto('/tirta.html'); await page.getByLabel('Nama proyek', { exact: true }).fill('Satu atap panjang'); await page.getByRole('button', { name: 'Buat proyek baru' }).click();
  await route(page, 'Hujan & kondisi awal'); await expect(page.getByLabel('Panjang persil')).toBeFocused();
  await page.getByLabel('Panjang persil').fill('15'); await page.getByLabel('Lebar persil').fill('10'); await page.getByRole('button', { name: 'Buat persil', exact: true }).click();
  await page.getByRole('button', { name: width === 390 ? 'Tambah zona' : 'Zona', exact: true }).click(); await page.getByRole('button', { name: 'Seluruh persil', exact: true }).click(); if (width === 390) await page.locator('.mobile-zone-summary').click(); await page.getByLabel('Jenis permukaan', { exact: true }).selectOption('roof'); if (width === 390) await page.keyboard.press('Escape');
  await route(page, 'Hujan & kondisi awal'); await expect(page.locator('.coefficient-launch')).toBeFocused();
  await page.locator('.coefficient-launch').click(); const modal = page.getByRole('dialog', {name:'Pilih dari patokan',exact:true}); await expect(modal.getByRole('button', { name: 'Terapkan',exact:true })).toBeInViewport(); await modal.getByRole('button', { name: /Tengah rentang/ }).first().click(); await modal.getByRole('button', { name: 'Terapkan',exact:true }).click(); if (width === 390) await page.keyboard.press('Escape');
  await route(page, 'Hujan & kondisi awal'); await page.getByLabel('Kedalaman hujan', { exact: true }).fill('60'); await page.getByRole('button', { name: /Terapkan hujan & hitung/ }).click(); await expect(page.locator('.rain-equation')).toContainText('9 m³');
  await route(page, 'Intervensi'); await page.getByRole('button', { name: 'Tambahkan Tangki', exact: true }).click();
  // A single source remains a single zone; no cosmetic subdivision is needed.
  if (!await editor(page).locator('.treatment-source-chips > span').count()) await choose(page, 'Pilih sumber limpasan', 'Zona 1');
  await editor(page).getByLabel('Jalur penyaluran').selectOption('gutter-downpipe'); await editor(page).getByLabel('Luas sumber sesuai area yang dilayani jalur ini').check(); await editor(page).getByLabel('Dasar rencana penyaluran').fill('Skenario uji: seluruh tangkapan tersambung. Belum survei.');
  await editor(page).getByRole('button', { name: 'Simpan & lanjut', exact: true }).click(); await editor(page).getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact: true }).fill('3'); await editor(page).getByRole('combobox', { name: 'Dasar kinerja', exact: true }).selectOption('user-entered'); await editor(page).getByLabel('Alasan dan batas penerapan').fill('Asumsi uji satu kejadian, bukan desain konstruksi.'); await editor(page).getByLabel('Kapasitas nominal tangki (m³)').fill('5'); await editor(page).getByLabel('Dasar ukuran tangki').fill('Asumsi uji');
  await editor(page).getByRole('button', { name: 'Simpan draft', exact: true }).click(); await expect(page.locator('.intervention-water-ledger')).toContainText('3 m³'); await expect(page.locator('.intervention-water-ledger')).toContainText('4,65 m³');
  await editor(page).getByRole('button', { name: /Biaya & lahan/ }).click(); await editor(page).getByLabel('Biaya (Rp)', { exact: true }).fill('3000000'); await editor(page).getByLabel('Ruang terpakai (m²)', { exact: true }).fill('2'); await editor(page).getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  await page.getByRole('button', { name: 'Ubah batas', exact: true }).click(); const limits = page.getByRole('dialog', { name: 'Batas rencana Anda', exact: true }); await limits.getByLabel('Anggaran (Rp)', { exact: true }).fill('5000000'); await limits.getByLabel('Lahan tersedia (m²)', { exact: true }).fill('10'); await limits.getByRole('button', { name: 'Terapkan batas rencana', exact: true }).click(); await page.keyboard.press('Escape'); await expect(limits).toBeHidden();
  await route(page, 'Alternatif'); await expect(page.locator('.compare-candidate')).toHaveCount(2); await route(page, 'Bandingkan');
  if (width === 390) await page.getByRole('button', { name: 'Angka & pilihan', exact: true }).click();
  const choosePlan = page.locator('.compare-matrix .primary:visible'); await choosePlan.last().click(); await expect(page.getByRole('heading', { name: 'Rencana pilihan Anda', exact: true, level:1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await shot(page, `fresh-one-roof-plan-${width}`);
  expect(errors).toEqual([]);
});

 test('installation soil reuse requires confirmation and can be withdrawn without inventing capacity', async ({page}) => {
  const p=emptyTreatments(); const context=emptySurfaceContext(); context.soil.infiltration={value:12,unit:'mm/h',origin:'user_supplied',source:'Synthetic location test assumption',method:'Synthetic',date:''}; p.science!.surfaces.z2=context;
  await open(page,p); await page.getByRole('button',{name:'Tambahkan Sumur / area resapan',exact:true}).click(); await source(page); await choose(page,'Belum dipilih','Tanah timur');
  await editor(page).getByRole('button',{name:'Simpan & lanjut',exact:true}).click();
  const confirmation=editor(page).getByLabel('Pengamatan ini berlaku pada lokasi pemasangan saya'); await expect(confirmation).not.toBeChecked(); await expect(editor(page).getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true})).toHaveValue('');
  await confirmation.check(); await editor(page).getByLabel('Dasar kesamaan lokasi / kondisi').fill('Synthetic assumption: installation uses the tested soil area.'); await editor(page).getByRole('button',{name:'Simpan draft',exact:true}).click();
  await expect(confirmation).toBeChecked(); await confirmation.uncheck(); await editor(page).getByRole('button',{name:'Simpan draft',exact:true}).click();
  await page.locator('.project-actions > summary').click(); await page.getByRole('button',{name:'Simpan',exact:true}).click(); await expect(page.locator('.save-state')).toContainText('Tersimpan'); await page.reload(); await page.locator('.local-projects > summary').click(); await page.locator('.local-projects button').filter({hasText:p.name}).first().click(); await route(page,'Intervensi'); await page.locator('.instance-select').filter({hasText:'Sumur / area resapan 2'}).click(); await editor(page).getByRole('button',{name:/Kapasitas/}).click();
  await expect(editor(page).getByLabel('Pengamatan ini berlaku pada lokasi pemasangan saya')).not.toBeChecked(); await expect(editor(page).getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true})).toHaveValue('');
 });

for (const width of [1440,390]) test(`direct Biopori entry, subtle marker edge and blank deselection preserve draft at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:width===390?844:900}); await open(page,emptyTreatments());
  const add=page.getByRole('button',{name:'Tambahkan Biopori',exact:true}); await expect(add).toBeVisible(); await add.click();
  await expect(editor(page).getByRole('combobox',{name:/Jenis resapan/})).toHaveValue('biopori');
  await source(page); await editor(page).getByRole('button',{name:'Belum dipilih',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Pilih lokasi penerapan',exact:true}); await expect(picker.locator('.role-zone-list button')).toHaveCount(4); await expect(picker.locator('.role-zone-list')).toContainText('Tanah timur'); await expect(picker.locator('.role-zone-list')).toContainText('Taman');
  await picker.getByRole('button',{name:'Pilih pada persil',exact:true}).click(); await page.locator('.intervention-preview [data-testid="zone-z0"]').click(); await expect(page.locator('.selection-role-cue')).toBeVisible(); await expect(page.locator('.notice')).toContainText('Atap'); await page.locator('.intervention-preview [data-testid="zone-z2"]').click(); await expect(page.locator('.selection-role-cue')).toHaveCount(0);
  await editor(page).getByRole('button',{name:'Simpan & lanjut',exact:true}).click(); await editor(page).getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true}).fill('1.25');
  const marker=page.locator('.intervention-preview [data-intervention-marker="soak-2"]'); await marker.click(); await expect(marker).toHaveAttribute('aria-pressed','true');
  await expect(marker).toHaveAttribute('aria-label', /lokasi Tanah timur; sumber Gedung belajar/);
  const soil=await page.locator('.intervention-preview [data-testid="zone-z2"]').boundingBox(); const initial=await marker.boundingBox(); expect(soil && initial).toBeTruthy();
  expect(initial!.x + initial!.width / 2).toBeGreaterThan(soil!.x); expect(initial!.x + initial!.width / 2).toBeLessThan(soil!.x + soil!.width); expect(initial!.y + initial!.height / 2).toBeGreaterThan(soil!.y); expect(initial!.y + initial!.height / 2).toBeLessThan(soil!.y + soil!.height);
  // A move onto the source roof is refused, rather than changing the installation silently.
  const before=await marker.getAttribute('transform'); const roof=await page.locator('.intervention-preview [data-testid="zone-z0"]').boundingBox();
  await page.mouse.move(initial!.x+initial!.width/2, initial!.y+initial!.height/2); await page.mouse.down(); await page.mouse.move(roof!.x+roof!.width/4,roof!.y+roof!.height/4,{steps:8}); await page.mouse.up();
  await expect(page.locator('.notice')).toContainText('Letakkan Biopori di zona yang dipilih sebagai lokasi pemasangan'); await expect(marker).toHaveAttribute('transform',before!);
  await page.getByRole('button',{name:'Tutup pemberitahuan'}).click(); await marker.click();
  await expect(marker.locator('circle')).toHaveCount(0); await expect(marker.locator('.marker-selection-edge')).toHaveCount(1); await expect(page.locator('.intervention-preview .marker-edge-sweep animateTransform')).toHaveAttribute('dur','5.5s');
  await shot(page,`biopori-selected-${width}`);
  const canvas=page.locator('.intervention-preview .parcel-svg'); await canvas.click({position:{x:5,y:5}}); await expect(marker).toHaveAttribute('aria-pressed','false'); await expect(page.locator('.instance-select[aria-pressed="true"]')).toHaveCount(0); await expect(editor(page)).toBeHidden(); await expect(page.locator('.active-intervention-editor')).toContainText('Isian terakhir tetap ada');
  await marker.click(); await expect(marker).toHaveAttribute('aria-pressed','true'); await expect(editor(page).getByLabel('Air yang dapat diresapkan (m³/event)',{exact:true})).toHaveValue('1.25');
  await canvas.focus(); await page.keyboard.press('Escape'); await expect(marker).toHaveAttribute('aria-pressed','false'); await marker.focus(); await page.keyboard.press('Enter'); await expect(marker).toHaveAttribute('aria-pressed','true');
  await page.emulateMedia({reducedMotion:'reduce'}); await expect(page.locator('.intervention-preview .marker-edge-sweep animateTransform')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
