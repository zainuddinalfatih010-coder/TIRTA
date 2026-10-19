import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10000); const errors: string[] = []; runtimeErrors.set(page, errors);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
async function reveal(field: Locator) {
  for (const d of await field.locator('xpath=ancestor::details').all()) if (await d.getAttribute('open') === null) await d.locator(':scope > summary').click();
}
const folder = 'evidence/scientific-revision/browser';
async function route(page: Page, name: string) {
  const mobile = page.getByLabel('Ruang kerja', { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else {
    if (name === 'Alternatif' || name === 'Bandingkan') await page.locator('.comparison-navigation > summary').click();
    await page.locator('.app-rail nav').getByRole('button', { name, exact: true }).click();
  }
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  for (const dialog of await page.getByRole('dialog').all()) expect(await dialog.evaluate(d => d.scrollWidth > d.clientWidth + 1)).toBe(false);
}
for (const journeyWidth of [1440,390]) test(`empty project → baseline → declared tank → alternatives → field record → save/reload at ${journeyWidth}`, async ({ page }) => {
  const folder = `evidence/uiux-candidate/presentation/journey-${journeyWidth}`;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir(folder, { recursive: true }); await page.setViewportSize({width:journeyWidth,height:journeyWidth===390?844:900}); await page.goto('/production.html');
  await page.getByLabel('Nama proyek', { exact: true }).fill('Revisi ilmiah — rumah'); await page.getByRole('button', { name: 'Buat proyek baru' }).click();
  await page.getByLabel('Panjang persil').fill('15'); await page.getByLabel('Lebar persil').fill('10'); await page.getByRole('button', { name: 'Buat persil', exact: true }).click();
  await page.getByRole('button', { name: journeyWidth===390 ? 'Tambah zona' : 'Zona', exact: true }).click(); await page.getByRole('button', { name: 'Seluruh persil' }).click();
  if(journeyWidth===390)await page.locator('.mobile-zone-summary').click();
  await page.getByLabel('Jenis permukaan', { exact: true }).selectOption('roof');
  await page.locator('.coefficient-help').getByRole('button').click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Tengah rentang/ }).first().click();
  await dialog.getByRole('button', { name: 'Terapkan data zona' }).click();
  await page.getByRole('button', { name: 'Kondisi permukaan & tujuan air' }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bentuk atap', { exact: true }).selectOption('sloped'); await dialog.getByLabel('Material atap').fill('Genteng — input pemilik');
  await dialog.getByLabel('Dasar kondisi permukaan').fill('Pengamatan pemilik'); await dialog.getByRole('button', { name: 'Simpan konteks' }).click();
  if(journeyWidth===390)await page.getByLabel('Kembali ke sketsa',{exact:true}).click();
  await route(page, 'Hujan & kondisi awal');
  await page.getByLabel('Kedalaman hujan', { exact: true }).fill('60'); await page.getByRole('button', { name: 'Terapkan hujan & hitung' }).click();
  await expect(page.locator('.rain-equation')).toContainText('9 m³');
  await page.getByRole('button', { name: 'Durasi & konteks hujan' }).click(); dialog = page.getByRole('dialog');
  await dialog.locator('input[name="duration"]').fill('120'); await dialog.locator('select[name="durationOrigin"]').selectOption('user_supplied'); await dialog.locator('input[name="durationSource"]').fill('Skenario uji durasi saya'); await dialog.getByRole('button', { name: 'Simpan durasi' }).click();
  await expect(page.locator('.rain-input')).toContainText('30 mm/jam');
  await page.screenshot({ path: `${folder}/rain-duration.png`, fullPage: true });
  await route(page, 'Intervensi'); await page.getByRole('button', { name: 'Tambahkan Tangki', exact: true }).click();
  await page.locator('[data-component="tank"] .instance-actions > summary').click();
  await page.locator('[data-component="tank"]').getByRole('button', { name: 'Atur intervensi', exact: true }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Biaya (Rp)', { exact: true }).fill('3000000'); await dialog.getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact: true }).fill('3');
  await reveal(dialog.getByLabel('Ruang terpakai (m²)', { exact: true }));
  await dialog.getByLabel('Ruang terpakai (m²)', { exact: true }).fill('2');
  if (!await dialog.locator('input[name="target"]:checked').count()) { await reveal(dialog.locator('input[name="target"]').first()); await dialog.locator('input[name="target"]').first().check(); }
  await dialog.getByRole('button', { name: 'Terapkan intervensi', exact: true }).click();
  await page.locator('.active-intervention-editor').getByRole('button', { name: /Perlu data tambahan · tinjau dasar/ }).click(); dialog = page.getByRole('dialog');
  await dialog.locator('select[name="origin"]').selectOption('user-entered'); await dialog.locator('input[name="performanceSource"]').fill('Asumsi kapasitas ruang kosong per kejadian');
  await dialog.locator('input[name="nominal"]').fill('5'); await dialog.locator('select[name="nominalOrigin"]').selectOption('user_supplied'); await dialog.locator('input[name="nominalSource"]').fill('Spesifikasi tangki yang dinyatakan pemilik'); await dialog.getByRole('button', { name: 'Simpan tinjauan' }).click();
  await page.locator('.active-intervention-editor').getByRole('button', { name: /tinjau dasar/ }).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Sumber & luapan', exact: true }).click();
  await dialog.locator('input[name="connected"]').check(); await dialog.locator('select[name="via"]').selectOption('gutter-downpipe'); await dialog.locator('input[name="connectionSource"]').fill('Rencana pipa dari atap ke tangki, perlu pemeriksaan'); await dialog.getByRole('button', { name: 'Simpan tinjauan' }).click();
  await page.getByRole('button', { name: 'Ubah batas', exact: true }).click();
  await page.getByLabel('Anggaran (Rp)', { exact: true }).fill('10000000'); await page.getByLabel('Lahan tersedia (m²)', { exact: true }).fill('20'); await page.getByRole('button', { name: 'Terapkan batas rencana', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.locator('.active-intervention-editor')).toContainText('Layak dengan syarat');
  await route(page, 'Alternatif'); await expect(page.locator('.compare-candidate')).toHaveCount(2); await expect(page.locator('.runoff-recommended')).toHaveCount(0);
  await page.screenshot({ path: `${folder}/alternatives.png`, fullPage: true });
  await route(page, 'Bandingkan'); await noOverflow(page);
  if(journeyWidth===390){await page.getByRole('button',{name:'Angka & pilihan',exact:true}).click();await page.locator('.compare-mobile-switch button').nth(1).click();}
  await page.locator('.comparison-row').getByRole('button', { name: 'Layak dengan syarat · periksa', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('talang / pipa turun'); await expect(page.getByRole('dialog')).toContainText('asumsi pengguna');
  await page.getByRole('dialog').getByRole('button', { name: 'Sumber: tampungan', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mengapa data ini diperlukan?', exact: true })).toContainText('Urban rainwater harvesting');
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Sumber: tampungan', exact: true })).toBeFocused();
  await page.screenshot({ path: `${folder}/comparison-evidence.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(page); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${folder}/comparison-evidence-mobile.png` }); await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape'); await route(page, 'Alternatif');
  await page.locator('.compare-matrix tbody tr').filter({ hasText: 'Tangki' }).getByRole('button', { name: 'Pilih rencana ini' }).click();
  await page.getByRole('tab', { name:'Langkah lapangan', exact:true }).click();
  await page.getByRole('button', { name: 'Catat sebelum & sesudah' }).click(); dialog = page.getByRole('dialog');
  await dialog.locator('input[name="eventDate"]').fill('2026-09-01'); await dialog.locator('input[name="eventRain"]').fill('60'); await dialog.locator('select[name="eventRainOrigin"]').selectOption('user_supplied'); await dialog.locator('input[name="eventRainSource"]').fill('Catatan pengamatan'); await dialog.locator('select[name="ponding"]').selectOption('observed'); await dialog.getByRole('button', { name: 'Simpan catatan' }).click();
  await expect(dialog).toContainText('Data belum cukup'); await dialog.getByRole('button', { name: 'Sesudah', exact: true }).click(); await dialog.locator('input[name="eventDate"]').fill('2026-09-02'); await dialog.locator('input[name="eventRain"]').fill('60'); await dialog.locator('select[name="eventRainOrigin"]').selectOption('user_supplied'); await dialog.locator('input[name="eventRainSource"]').fill('Catatan pengamatan'); await dialog.locator('select[name="ponding"]').selectOption('not-observed'); await dialog.getByRole('button', { name: 'Simpan catatan' }).click();
  await dialog.getByRole('button', { name: 'Pemasangan & konteks', exact: true }).click(); await dialog.locator('select[name="comparable"]').selectOption('yes'); await dialog.locator('input[name="comparisonBasis"]').fill('Hujan, kondisi awal dan metode dicatat sebanding'); await dialog.locator('select[name="installed"]').selectOption('yes'); await dialog.locator('input[name="installationNote"]').fill('Diperiksa pemilik'); await dialog.getByRole('button', { name: 'Simpan catatan' }).click(); await expect(dialog).toContainText('Ada indikasi membaik');
  await page.screenshot({ path: `${folder}/field-evaluation.png` }); await page.keyboard.press('Escape');
  await page.locator(".project-actions > summary").click(); await page.getByRole('button', { name: 'Simpan', exact: true }).click(); await expect(page.locator('.save-state')).toContainText('Tersimpan'); await page.reload();
  await page.locator('.local-projects').getByRole('button', { name: /^Revisi ilmiah/ }).click(); await route(page, 'Rencana & Dampak'); await page.getByRole('tab', { name:'Langkah lapangan', exact:true }).click(); await expect(page.locator('.field-evaluation')).toContainText('Ada indikasi membaik');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh ringkasan', exact: true }).click()]); expect(download.suggestedFilename()).toBe('TIRTA-rencana.txt');
  const report = await readFile((await download.path())!, 'utf8'); expect(report).toContain('TINJAUAN ILMIAH'); expect(report).toContain('UNKNOWN'); expect(report).toContain('J-RWH-2017'); expect(report).toContain('Ada indikasi membaik');
  await noOverflow(page); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); expect(errors).toEqual([]);
});
test('unknown soil excludes only incomplete candidates and the review remains usable on small screens', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/production.html'); await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click(); await route(page, 'Intervensi');
  for (const label of ['Tangki', 'Sumur / area resapan']) await page.getByRole('button', { name: `Tambahkan ${label}`, exact: true }).click();
  await page.locator('.active-intervention-editor').getByRole('button', { name: /tinjau dasar/ }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await dialog.locator('input[name="soil"]').fill(''); await dialog.getByRole('button', { name: 'Simpan tinjauan' }).click();
  await expect(page.locator('.active-intervention-editor')).toContainText('Perlu data tambahan'); await route(page, 'Alternatif');
  await expect(page.locator('.compare-candidate').filter({ hasText: 'Tangki' })).toHaveCount(1); await expect(page.locator('.compare-candidate').filter({ hasText: 'Sumur / area resapan' })).toHaveCount(0);
  await route(page, 'Intervensi'); await page.locator('.active-intervention-editor').getByRole('button', { name: /tinjau dasar/ }).click(); await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  for (const [width, height] of [[1440, 900], [1366, 768], [390, 844]]) {
    await page.setViewportSize({ width: width!, height: height! }); await noOverflow(page);
    await expect(dialog.getByRole('button', { name: 'Simpan tinjauan' })).toBeInViewport();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${folder}/feasibility-${width}.png` });
  }
  await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});
test('contextual evidence shows relevant primary references, complete library and UNKNOWN duration', async ({ page }) => {
  await page.goto('/production.html'); await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
  await page.getByRole('button', { name: 'Dasar TIRTA', exact: true }).click(); await page.getByRole('button', { name: 'Jelajahi seluruh referensi', exact: true }).click(); const library = page.getByRole('dialog', { name: 'Dasar ilmiah TIRTA', exact: true });
  await expect(library.locator('.scientific-references > li')).toHaveCount(32);
  await library.getByLabel('Cari referensi').fill('Jakarta'); await expect(library.locator('.scientific-references > li')).toHaveCount(1);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await route(page, 'Hujan & kondisi awal'); await page.getByRole('button', { name: 'Durasi & konteks hujan' }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.locator('input[name="duration"]')).toHaveValue('');
  await dialog.locator('input[name="duration"]').fill('0'); await dialog.locator('select[name="durationOrigin"]').selectOption('user_supplied'); await dialog.locator('input[name="durationSource"]').fill('test'); await dialog.getByRole('button', { name: 'Simpan durasi' }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.locator('input[name="duration"]').fill(''); await dialog.getByRole('button', { name: 'Simpan durasi' }).click(); await expect(page.locator('.rain-input')).not.toContainText('Intensitas rata-rata');
});


test('synthetic uncertainty example and contradictory routing recover without changing the baseline', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/production.html'); await page.getByRole('button', { name: 'Contoh: data lapangan belum lengkap', exact: true }).click();
  await route(page, 'Intervensi');
  for (const label of ['Tangki', 'Rain garden', 'Sumur / area resapan']) await page.getByRole('button', { name: `Tambahkan ${label}`, exact: true }).click();
  for (const [id, status] of [["tank", "Layak untuk pra-perencanaan"], ["garden", "Layak dengan syarat"], ["soak", "Perlu data tambahan"]]) {
    await page.locator(`[data-component="${id}"] .instance-select`).click();
    await expect(page.locator('.active-intervention-editor')).toContainText(status!);
  }
  await page.screenshot({ path: `${folder}/uncertainty-demo.png`, fullPage: true });
  await route(page, 'Studio Persil'); await page.locator('.zone-register .zone-row').nth(0).click();
  await page.getByRole('button', { name: 'Kondisi permukaan & tujuan air' }).click();
  let dialog = page.getByRole('dialog'); await dialog.locator('select[name="destination"]').selectOption('zone:z1'); await dialog.locator('input[name="routeSource"]').fill('Declared route from roof to paved zone'); await dialog.getByRole('button', { name: 'Simpan konteks' }).click();
  await page.locator('.zone-register .zone-row').nth(1).click(); await page.getByRole('button', { name: 'Kondisi permukaan & tujuan air' }).click();
  dialog = page.getByRole('dialog'); await dialog.locator('select[name="destination"]').selectOption('zone:z0'); await dialog.locator('input[name="routeSource"]').fill('Contradictory route, test only'); await dialog.getByRole('button', { name: 'Simpan konteks' }).click();
  await expect(dialog.getByRole('alert')).toContainText('siklus'); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
  await route(page, 'Hujan & kondisi awal'); await expect(page.locator('.rain-split')).toContainText('6,27');
  await page.getByRole('button', { name: 'Dasar TIRTA', exact: true }).click(); await page.getByRole('button', { name: 'Jelajahi seluruh referensi', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Dasar ilmiah TIRTA', exact: true }); await dialog.getByLabel('Cari referensi').fill('unmatched-query-987'); await expect(dialog.getByRole('status')).toContainText('Tidak ada referensi');
  await dialog.getByLabel('Cari referensi').fill(''); await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(page); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${folder}/references-mobile.png` }); await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});

test('legacy backup imports UNKNOWN science, preserves rainfall and survives a portable round trip', async ({ page }) => {
  await page.goto('/production.html'); await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click(); await route(page, 'Proyek');
  await page.locator('.project-backup > summary').click();
  const legacy = JSON.parse(await readFile('docs/scientific-revision/baseline-fixture.json', 'utf8')).project;
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'legacy.tirta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'tirta-project', formatVersion: 1, project: legacy })) });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Studio Persil');
  await route(page, 'Hujan & kondisi awal'); await expect(page.locator('.rain-equation')).toContainText('10 m³'); await expect(page.locator('.rain-split')).toContainText('6,27');
  await route(page, 'Intervensi'); await expect(page.locator('.active-intervention-editor')).toContainText('Perlu data tambahan');
  await route(page, 'Proyek'); await page.locator('.project-backup > summary').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh cadangan proyek' }).click()]);
  const file = (await download.path())!, backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.project.science.schemaVersion).toBe(1); expect(backup.project.science.legacyNeedsVerification).toContain('tank');
  expect(backup.project.science.interventions).toEqual({});
  expect(backup.project.parameters).toEqual(legacy.parameters);
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles(file); await route(page, 'Hujan & kondisi awal'); await expect(page.locator('.rain-split')).toContainText('6,27');
  await noOverflow(page);
});
