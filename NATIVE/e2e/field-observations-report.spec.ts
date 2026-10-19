import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { recordFieldObservation } from '../src/domain/fieldObservations';
import { planningFingerprint, snapshotPlan } from '../src/domain/planningEngine';
import { buildProjectReport } from '../src/report/projectReport';
import type { ProjectV2 } from '../src/domain/projectV2';
import { createProjectV2 } from '../src/domain/projectV2';
import { addSimpleArea } from '../src/domain/simpleAreas';
import { projectBackup } from '../src/persistence/portable';

const out = 'E:/CodexStore/home/audits/tirta-field-2026-10-08/observations-report';
async function importProject(page: Page, p: ProjectV2) {
  await page.goto('/tirta.html');
  await page.evaluate(() => {
    const auditWindow = window as Window & { fieldNotices?: string[] };
    auditWindow.fieldNotices = [];
    new MutationObserver(() => {
      const note = document.querySelector('.notice')?.textContent;
      if (note && !auditWindow.fieldNotices!.includes(note)) auditWindow.fieldNotices!.push(note);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  const portable = projectBackup(p);
  await writeFile(`${out}/import-fixture-${p.id.replace(/[^a-z0-9-]/gi, '')}.tirta.json`, portable);
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'field.tirta.json', mimeType: 'application/json', buffer: Buffer.from(portable) });
  try { await expect(page.locator('.view-studio')).toBeVisible(); }
  catch (e) { await writeFile(`${out}/import-failure-notices.json`, JSON.stringify(await page.evaluate(() => (window as Window & { fieldNotices?: string[] }).fieldNotices), null, 2)); throw e; }
}
async function report(page: Page) {
  await page.locator('.project-actions > summary').click(); await page.getByRole('button', { name: 'Laporan proyek', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bagikan hasil' })).toBeVisible();
}
async function pdf(page: Page, name: string, p: ProjectV2) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh PDF', exact: true }).click()]);
  await download.saveAs(`${out}/${name}.pdf`);
  expect((await readFile((await download.path())!)).subarray(0, 5).toString()).toBe('%PDF-');
  await writeFile(`${out}/${name}-report.json`, JSON.stringify(buildProjectReport(p, 'r50'), null, 2));
}
test.beforeEach(async ({ page }) => {
  await mkdir(out, { recursive: true });
  const errors: string[] = [];
  (page as Page & { fieldErrors: string[] }).fieldErrors = errors;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
});
test.afterEach(async ({ page }, info) => {
  const errors = (page as Page & { fieldErrors: string[] }).fieldErrors;
  await writeFile(`${out}/${info.title.replace(/[^a-z0-9]/gi, '-')}-errors.json`, JSON.stringify(errors));
  expect(errors).toEqual([]);
});

test('a first-time observer records context without filling numeric science or mandatory notes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const p = setActiveComponents(demoProject(true), []);
  await importProject(page, p); await page.getByTestId('zone-z2').click();
  const observation = page.getByLabel('Kondisi yang pernah Anda lihat', { exact: true });
  await expect(observation).toHaveValue('unknown');
  await observation.selectOption('ponding');
  await expect(page.locator('.field-observation-control')).toContainText('Di bagian mana air tertahan');
  await page.getByRole('button', { name: 'Tambahkan catatan (opsional)', exact: true }).click();
  await page.getByLabel('Catatan pengamatan area', { exact: true }).fill('Tertahan di sisi pintu.');
  await observation.selectOption('concentrated-runoff');
  await expect(page.getByLabel('Catatan pengamatan area', { exact: true })).toHaveValue('Tertahan di sisi pintu.');
  await observation.selectOption('ponding');
  await observation.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(observation).toHaveValue('ponding');
  expect((await new AxeBuilder({ page }).include('.studio-inspector').analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${out}/observation-mobile.png` });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await report(page);
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Cadangan proyek', exact: true }).click()]);
  const saved = (JSON.parse(await readFile((await backup.path())!, 'utf8')) as { project: ProjectV2 }).project;
  expect(saved.science?.surfaces.z2?.fieldObservation).toEqual({ condition: 'ponding', note: 'Tertahan di sisi pintu.' });
  expect(saved.parameters).toEqual(p.parameters); expect(saved.components).toEqual(p.components);
  expect(saved.science?.surfaces.z2?.soil.infiltration.value).toBeNull();
  expect(errors).toEqual([]);
});

test('a real entered-area project report does not invent shape dimensions or an impact while inputs are unknown', async ({ page }) => {
  let serial = 0;
  const area = addSimpleArea(createProjectV2('simple-field-report', 'Area dekat pintu', '2026-10-08T12:00:00.000Z'), { name: 'Tanah dekat pintu', surface: 'soil', area: 50, parcelArea: 150 }, () => `simple-field-${++serial}`);
  const p = recordFieldObservation(area.project, area.zoneId, { condition: 'ponding', note: 'Pengamatan pengguna; belum ada pengukuran tanah.' });
  await importProject(page, p); await report(page);
  await expect(page.locator('.report-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Persil dan kontribusi permukaan', exact: true }).click();
  await expect(page.locator('.tirta-report')).toContainText('bentuk area sederhana belum diukur');
  await expect(page.locator('.tirta-report')).toContainText('50 m²');
  await pdf(page, 'simple-area-ponding-unknown', p);
});

test('field observation survives area selection, reload and a real exported selected report', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const p = recordFieldObservation(setActiveComponents(demoProject(true), ['tank']), 'z2', { condition: 'ponding', note: 'Air tertahan dekat pintu.' });
  p.components[0]!.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic reviewed source for software testing.', catchmentReviewed: true };
  p.selectedPlan = { definition: snapshotPlan(p, ['tank'], 'field-tank', 'Tangki pilihan'), decisionNote: '', reviewedInputFingerprint: planningFingerprint(p) };
  await importProject(page, p); await report(page);
  await page.getByRole('button', { name: 'Persil dan kontribusi permukaan', exact: true }).click();
  await expect(page.locator('.tirta-report')).toContainText('Air tertahan dekat pintu.');
  await expect(page.locator('.tirta-report figure svg')).toBeVisible();
  await expect(page.locator('.tirta-report figure svg')).toContainText('I1');
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.project-report-dialog').analyze()).violations).toEqual([]);
    await page.locator('.tirta-report figure svg').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/selected-map-${width}.png` });
  }
  await pdf(page, 'selected-tank-ponding', p);
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Cadangan proyek', exact: true }).click()]);
  const restored = JSON.parse(await readFile((await backup.path())!, 'utf8')) as { project: ProjectV2 };
  expect(restored.project.science?.surfaces.z2?.fieldObservation?.note).toBe('Air tertahan dekat pintu.');
  await page.keyboard.press('Escape'); await page.reload();
  await page.locator('.local-projects > summary').click();
  await page.locator('.local-project-row .open-project').filter({ hasText: 'Sekolah Taman Sari' }).click();
  await expect(page.locator('.view-studio')).toBeVisible();
  await report(page); await page.getByRole('button', { name: 'Persil dan kontribusi permukaan', exact: true }).click();
  await expect(page.locator('.tirta-report')).toContainText('Air tertahan dekat pintu.');
  expect(errors).toEqual([]);
});

test('unknown Biopori PDF and stale selection show withheld impact instead of zero success', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let p = (JSON.parse(await readFile('E:/CodexStore/home/audits/tirta-rescue-2026-10-07/report/biopori-fixture.tirta.json', 'utf8')) as { project: ProjectV2 }).project;
  p = recordFieldObservation(p, 'z2', { condition: 'ponding', note: 'Pengamatan sintetis untuk uji perangkat lunak.' });
  const biopori = p.components.find(c => c.family === 'infiltration' && c.infiltrationType === 'biopori')!;
  if (biopori.family !== 'infiltration') throw new Error('fixture');
  const ref = biopori.performanceByScenario.r50!.infiltrationCapacity;
  ref.evidence = 'UNKNOWN'; const parameter = p.parameters.find(v => v.id === ref.id)!; parameter.value = null; parameter.evidence = 'UNKNOWN';
  p = setActiveComponents(p, [biopori.id]);
  p.selectedPlan = { definition: snapshotPlan(p, [biopori.id], 'unknown-biopori', 'Biopori belum dapat dihitung'), decisionNote: '', reviewedInputFingerprint: planningFingerprint(p) };
  await importProject(page, p); await report(page);
  await expect(page.locator('.report-result')).toHaveCount(0);
  await expect(page.locator('.tirta-report')).toContainText('Dampak belum dapat dihitung');
  await expect(page.locator('.tirta-report')).toContainText('Kapasitas per kejadian belum diketahui');
  await pdf(page, 'unknown-biopori-ponding', p); await page.keyboard.press('Escape');
  p.selectedPlan!.reviewedInputFingerprint = 'older-input';
  await importProject(page, p); await report(page); await expect(page.locator('.report-result')).toHaveCount(0);
  await pdf(page, 'stale-biopori', p); expect(errors).toEqual([]);
});
