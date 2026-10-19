import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import type { ProjectV2 } from '../src/domain/projectV2';
import { emptySurfaceContext, unknownNumber } from '../src/domain/scientificContract';

const out='evidence/uiux-candidate/intervention-lifecycle/intervention-review';
function fixture() {
  const p = setActiveComponents(demoProject(true), ['soak']);
  const c = p.components.find(c => c.id === 'soak')!;
  if (c.family === 'infiltration') c.infiltrationType = 'biopori';
  c.name = 'Biopori 2';
  c.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic fixture', catchmentReviewed: true };
  return p;
}
async function open(page: Page, p: ProjectV2) {
  await page.goto('/tirta.html');
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'review-synthetic.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(p)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  await page.locator('.treatment-composer .option-config-trigger').click();
  return page.getByRole('dialog', { name: 'Kelayakan Biopori 2', exact: true });
}
async function exported(page: Page) {
  await page.locator('.project-actions > summary').click();
  await page.getByRole('button', { name: 'Laporan proyek', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Cadangan proyek', exact: true }).click()]);
  return (JSON.parse(await readFile((await download.path())!, 'utf8')) as { project: ProjectV2 }).project;
}
test.beforeEach(async ({ page }) => {
  await mkdir(out, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  (page as Page & { reviewErrors: string[] }).reviewErrors = errors;
});
test.afterEach(async ({ page }) => expect((page as Page & { reviewErrors: string[] }).reviewErrors).toEqual([]));

test('assumed capacity asks no measurement fields; measured origin reveals and validates them', async ({ page }) => {
  const dialog = await open(page, fixture());
  await expect(dialog.locator('input:visible,select:visible')).toHaveCount(0);
  await dialog.getByText('Dasar kapasitas: Asumsi pengguna', { exact: true }).click();
  await expect(dialog.locator('input:visible,select:visible')).toHaveCount(2);
  await expect(dialog.locator('[name=performanceMethod]')).not.toBeVisible();
  await dialog.locator('[name=origin]').selectOption('measured');
  await expect(dialog.locator('[name=performanceMethod]')).toBeVisible();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name=performanceMethod]')).toBeFocused();
  await dialog.locator('[name=performanceMethod]').fill('Synthetic bucket measurement');
  await dialog.locator('[name=performanceDate]').fill('2026-10-08');
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const beforeCommit = await exported(page);
  expect(beforeCommit.science!.interventions.soak!.performance.r50!.origin).toBe('user-entered');
  await page.getByRole('dialog', { name: 'Bagikan hasil' }).getByRole('button', { name: 'Tutup', exact: true }).click();
  await page.locator('.treatment-composer').getByRole('button', {name:'Simpan penanganan',exact:true}).click();
  const saved = await exported(page);
  expect(saved.science!.interventions.soak!.performance.r50).toMatchObject({ origin: 'measured', method: 'Synthetic bucket measurement', date: '2026-10-08' });
});

test('collapsed technical details survive saving and reload with UNKNOWN unchanged', async ({ page }) => {
  const p = fixture(), original = structuredClone(p.science!.interventions.soak!);
  const dialog = await open(page, p);
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await expect(dialog.getByText('Rincian pelaksanaan (opsional)', { exact: true })).toBeVisible();
  await expect(dialog.locator('[name=standardReview]')).not.toBeVisible();
  await expect(dialog.locator('input:visible,select:visible')).toHaveCount(2);
  await dialog.getByText('Rincian pelaksanaan (opsional)', { exact: true }).click();
  await dialog.locator('[name=maintenance]').fill('Synthetic updated maintenance');
  await dialog.getByText('Rincian pelaksanaan (opsional)', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.locator('.treatment-composer').getByRole('button', {name:'Simpan penanganan',exact:true}).click();
  const saved = await exported(page), e = saved.science!.interventions.soak!;
  expect(saved.parameters).toEqual(p.parameters);
  const old = p.components.find(c=>c.id==='soak')!, current = saved.components.find(c=>c.id==='soak')!;
  expect(current).toMatchObject({id:old.id,family:old.family,targets:old.targets,treatment:old.treatment,performanceByScenario:old.performanceByScenario,totalCost:old.totalCost,occupiedArea:old.occupiedArea});
  for (const key of ['groundwaterDepth', 'localStandardReview', 'localStandardBasis', 'fieldVerified', 'verificationSource', 'condition', 'soilInfiltration'] as const) expect(e[key]).toEqual(original[key]);
  expect(e.maintenance).toBe('Synthetic updated maintenance');
  await page.getByRole('dialog', { name: 'Bagikan hasil' }).getByRole('button', { name: 'Tutup', exact: true }).click();
  await page.locator('.project-actions > summary').click();
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.locator('.local-save-indicator')).toHaveAttribute('aria-label', 'Tersimpan lokal');
  await page.reload();
  await page.locator('.local-projects > summary').click();
  await page.locator('.local-projects').getByRole('button', { name: /^Sekolah Taman Sari/ }).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  await page.locator('.treatment-composer .option-config-trigger').click();
  await page.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await page.getByText('Rincian pelaksanaan (opsional)', { exact: true }).click();
  await expect(page.locator('.intervention-review [name=maintenance]')).toHaveValue('Synthetic updated maintenance');
  await expect(page.locator('.intervention-review [name=groundwater]')).toHaveValue('');
});

test('confirmed zone soil is reused without asking again, and direct evidence remains editable', async ({ page }) => {
  const p = fixture();
  const observation = { value: 8, unit: 'mm/h' as const, origin: 'user_supplied' as const, source: 'Synthetic shared soil', method: '', date: '' };
  p.science!.surfaces.z2 = emptySurfaceContext();
  p.science!.surfaces.z2.soil.infiltration = observation;
  p.science!.interventions.soak!.soilReference = { zoneId: 'z2', confirmation: 'Same synthetic installation zone', observation: structuredClone(observation) };
  const dialog = await open(page, p);
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await expect(dialog.getByLabel('Bukti infiltrasi tanah', { exact: true })).not.toBeVisible();
  await expect(dialog).toContainText('Tanah timur: 8 mm/jam');
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  const saved = await exported(page);
  expect(saved.science!.interventions.soak!.soilReference).toEqual(p.science!.interventions.soak!.soilReference);
  expect(saved.science!.interventions.soak!.soilInfiltration).toEqual(p.science!.interventions.soak!.soilInfiltration);
  await page.getByRole('dialog', { name: 'Bagikan hasil' }).getByRole('button', { name: 'Tutup', exact: true }).click();
  await page.locator('.treatment-composer .option-config-trigger').click();
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await dialog.getByLabel('Gunakan data tanah zona', { exact: true }).uncheck();
  await dialog.getByText('Data tanah: 10 mm/jam', { exact: true }).click();
  await expect(dialog.getByLabel('Bukti infiltrasi tanah', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await page.locator('.treatment-composer').getByRole('button', {name:'Simpan penanganan',exact:true}).click();
  expect((await exported(page)).science!.interventions.soak!.soilReference).toBeUndefined();
});

test('unknown and adverse site assessments remain explicit instead of gaining eligibility', async ({ page }) => {
  const p = fixture();
  p.science!.interventions.soak!.groundwaterAssessment = 'unknown';
  p.science!.interventions.soak!.groundwaterBasis = '';
  p.science!.interventions.soak!.soilInfiltration = unknownNumber('mm/h');
  const dialog = await open(page, p);
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await expect(dialog.locator('[name=groundwaterBasis]')).not.toBeVisible();
  await expect(dialog).toContainText('Dampak resapan menunggu pemeriksaan air tanah');
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await page.locator('.treatment-composer').getByRole('button', {name:'Simpan penanganan',exact:true}).click();
  await expect(page.locator('.composer-readiness')).toContainText('Belum lengkap.');
  const saved = await exported(page);
  expect(saved.science!.interventions.soak!.groundwaterAssessment).toBe('unknown');
  expect(saved.science!.interventions.soak!.soilInfiltration.value).toBeNull();
  await page.getByRole('dialog', { name: 'Bagikan hasil' }).getByRole('button', { name: 'Tutup', exact: true }).click();
  await page.locator('.treatment-composer .option-config-trigger').click();
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await dialog.locator('[name=groundwaterAssessment]').selectOption('unsuitable');
  await dialog.locator('[name=groundwaterBasis]').fill('Synthetic unsuitable condition');
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await page.locator('.treatment-composer .option-config-trigger').click();
  await expect(dialog.getByText('Masalah yang perlu diperbaiki', { exact: true })).toBeVisible();
  await expect(dialog.locator('.review-issues')).toHaveAttribute('open', '');
});

test('compact review keeps save, labels and disclosures accessible across screen sizes', async ({ page }) => {
  const dialog = await open(page, fixture());
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 650], [1280, 800], [768, 1024], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true })).toBeInViewport();
    expect((await new AxeBuilder({ page }).include('.intervention-review').analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${out}/site-${width}.png` });
  }
  await dialog.getByText('Rincian pelaksanaan (opsional)', { exact: true }).click();
  await expect(dialog.locator('[name=standardReview]')).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.intervention-review').analyze()).violations).toEqual([]);
});

test('incomplete measured evidence in another tab opens the required fields without a focus error', async ({ page }) => {
  const dialog = await open(page, fixture());
  await dialog.getByText('Dasar kapasitas: Asumsi pengguna', { exact: true }).click();
  await dialog.locator('[name=origin]').selectOption('measured');
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(dialog.locator('[name=performanceMethod]')).toBeVisible();
  await expect(dialog.locator('[name=performanceMethod]')).toBeFocused();
  await dialog.locator('[name=origin]').selectOption('user-entered');
  await expect(dialog.locator('[name=performanceMethod]')).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('a changed zone observation cannot remain silently reused by the compact form', async ({ page }) => {
  const p = fixture();
  p.science!.surfaces.z2 = emptySurfaceContext();
  const observation = { value: 8, unit: 'mm/h' as const, origin: 'user_supplied' as const, source: 'Synthetic shared soil', method: '', date: '' };
  p.science!.surfaces.z2.soil.infiltration = { ...observation, value: 9 };
  p.science!.interventions.soak!.soilReference = { zoneId: 'z2', confirmation: 'Same synthetic installation zone', observation };
  const dialog = await open(page, p);
  await dialog.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await expect(dialog).toContainText('Data tanah zona berubah');
  await expect(dialog.getByLabel('Gunakan data tanah zona', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Bukti infiltrasi tanah', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Simpan tinjauan', exact: true }).click();
  await page.locator('.treatment-composer').getByRole('button', {name:'Simpan penanganan',exact:true}).click();
  await expect(page.locator('.composer-readiness')).toContainText('Belum lengkap.');
  expect((await exported(page)).science!.interventions.soak!.soilReference).toEqual(p.science!.interventions.soak!.soilReference);
});
