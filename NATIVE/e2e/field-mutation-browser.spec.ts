import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { projectV2Schema, type ProjectV2 } from '../src/domain/projectV2';
import { readInput } from '../src/domain/planningAuthoring';
import { fieldDecisionReadiness } from '../src/domain/fieldDecisionReadiness';

const out='evidence/uiux-candidate/intervention-lifecycle/field-mutation-browser';
async function revealAncestors(locator: ReturnType<Page['locator']>) {
  for (const details of await locator.locator('xpath=ancestor::details').all()) {
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  }
}
async function nav(page: Page, name: string) {
  const button = page.locator('.app-rail nav').getByRole('button', { name, exact: true, includeHidden: true });
  await revealAncestors(button); await button.click();
}
async function report(page: Page) {
  const menu = page.locator('.project-actions');
  if (await menu.getAttribute('open') === null) await menu.locator(':scope > summary').click();
  await menu.getByRole('button', { name: 'Laporan proyek', exact: true }).click();
  return page.getByRole('dialog', { name: 'Bagikan hasil', exact: true });
}
async function checkpoint(page: Page, name: string) {
  const dialog = await report(page);
  const download = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Cadangan proyek', exact: true }).click()]).then(v => v[0]);
  await download.saveAs(`${out}/${name}.tirta.json`);
  const payload = JSON.parse(await readFile(`${out}/${name}.tirta.json`, 'utf8'));
  const project = projectV2Schema.parse(payload.project);
  await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
  return project;
}
async function openTreatment(page: Page, name: string) {
  await page.getByRole('button', { name: `Tindakan ${name}`, exact: true }).click();
  await page.getByRole('dialog', { name, exact: true }).getByRole('button', { name: 'Atur intervensi', exact: true }).click();
  await expect(page.locator('.treatment-heading h2')).toHaveText(name);
}
function capacity(project: ProjectV2, id: string) {
  const c = project.components.find(c => c.id === id)!;
  if (c.family !== 'storage') throw new Error('Synthetic fixture must use tank storage');
  return readInput(project, c.performanceByScenario.r50!.availableStorage).text;
}

test('real UI preserves explicit choices through copy, removal, limits, rain, unknown and zero capacity, reload and exports', async ({ page, browser }) => {
  await mkdir(out, { recursive: true });
  const runtime: { kind: string; message: string }[] = [];
  page.on('pageerror', e => runtime.push({ kind: 'pageerror', message: e.message }));
  page.on('console', m => { if (m.type() === 'error') runtime.push({ kind: 'console', message: m.text() }); });
  const p = setActiveComponents(demoProject(), ['tank']); p.name = 'Uji mutasi sintetis';
  const tank = p.components.find(c => c.id === 'tank')!;
  tank.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Explicit synthetic test only', catchmentReviewed: true };
  const initialCapacity = capacity(p, 'tank');
  await page.goto('/tirta.html');
  const upload = page.getByLabel('Buka berkas cadangan'); await revealAncestors(upload);
  await upload.setInputFiles({ name: 'mutation-synthetic.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(p)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  await nav(page, 'Intervensi');

  await page.getByRole('button', { name: 'Tindakan Tangki atap', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tangki atap', exact: true }).getByRole('button', { name: 'Buat salinan', exact: false }).click();
  const composer = page.locator('.treatment-composer');
  await composer.getByRole('button', { name: '2 Kapasitas', exact: true }).click();
  await expect(composer.locator('[name=capacity]')).toHaveValue('');
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  const draft = await checkpoint(page, '01-explicit-copy-draft');
  const copy = draft.components.find(c => c.name === 'Tangki atap (salinan)')!;
  expect(copy).toBeTruthy(); expect(capacity(draft, copy.id)).toBe('');
  expect(capacity(draft, 'tank')).toBe(initialCapacity);
  expect(fieldDecisionReadiness(draft, 'r50').treatments.find(t => t.id === copy.id)!.calculationReady).toBe(false);

  await composer.getByRole('button', { name: '1 Hubungan', exact: true }).click();
  await composer.getByRole('button', { name: 'Lepas sumber Gedung belajar', exact: true }).click();
  await composer.locator('[data-role-choice=source]').click();
  await page.getByRole('dialog', { name: 'Pilih sumber limpasan', exact: true }).getByRole('button', { name: /^Taman\b/ }).click();
  await composer.locator('[data-role-choice=installation]').click();
  await page.getByRole('dialog', { name: 'Pilih lokasi penerapan', exact: true }).getByRole('button', { name: /^Tanah timur\b/ }).click();
  await composer.locator('[name=via]').selectOption('edge');
  await composer.locator('[data-stage="0"] details').filter({hasText:'Catatan jalur (opsional)'}).locator('summary').click();await composer.locator('[name=connectionSource]').fill('Rencana sintetis: limpasan Taman menuju tangki tambahan.');
  await composer.locator('[name=catchmentReviewed]').check();
  await composer.getByRole('button', { name: 'Lanjut', exact: false }).click();
  await composer.locator('[name=capacity]').fill('1');
  await composer.locator('[name=capacityBasis]').selectOption('user-entered');
  await composer.getByRole('button', { name: 'Lanjut', exact: false }).click();
  await composer.locator('[name=cost]').fill('1000000'); await composer.locator('[name=area]').fill('1');
  await composer.getByLabel('Nama penanganan (opsional)', { exact: true }).fill('Tangki tambahan uji');
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  await expect(page.locator('.intervention-option').filter({ hasText: 'Tangki tambahan uji' })).toBeVisible();
  const saved = await checkpoint(page, '02-independent-copy-saved');
  expect(capacity(saved, copy.id)).toBe('1'); expect(capacity(saved, 'tank')).toBe(initialCapacity);
  expect(saved.components.find(c => c.id === copy.id)!.targets).toEqual(['z3']);
  expect(fieldDecisionReadiness(saved, 'r50').treatments.find(t => t.id === copy.id)!.calculationReady).toBe(true);

  await openTreatment(page, 'Tangki atap');
  await composer.getByText('Luapan (opsional)',{exact:true}).click();await composer.locator('[name=overflow]').selectOption(`intervention:${copy.id}`);
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  const routed = await checkpoint(page, '03-explicit-overflow');
  expect(routed.science!.interventions.tank!.overflow).toEqual({ kind: 'intervention', id: copy.id });
  await page.getByRole('button', { name: 'Tindakan Tangki tambahan uji', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tangki tambahan uji', exact: true }).getByRole('button', { name: /Simpan untuk nanti/ }).click();
  const removed = await checkpoint(page, '04-copy-inactive-recipient-cleared');
  expect(removed.components.find(c => c.id === copy.id)!.enabled).toBe(false);
  expect(removed.science!.interventions.tank!.overflow.kind).toBe('unknown');
  await openTreatment(page, 'Tangki atap');
  await expect(composer.locator(`[name=overflow] option[value="intervention:${copy.id}"]`)).toHaveCount(0);

  const limits = page.locator('.constraint-editor');
  const changeLimits = async (budget: string) => {
    await page.getByRole('button', { name: 'Ubah batas', exact: true }).click();
    await limits.locator('[name=budget]').fill(budget); await limits.locator('[name=land]').fill('24');
    await limits.getByRole('button', { name: 'Terapkan batas rencana', exact: true }).click();
    await page.getByRole('dialog', { name: 'Batas rencana Anda', exact: true }).getByRole('button', { name: 'Tutup', exact: true }).click();
  };
  await changeLimits('1'); const tight = await checkpoint(page, '05-explicit-tight-budget');
  expect(fieldDecisionReadiness(tight, 'r50').activePackage.calculationReady).toBe(true);
  expect(fieldDecisionReadiness(tight, 'r50').activePackage.comparisonReady).toBe(false);
  await changeLimits('12000000'); await nav(page, 'Alternatif');
  const row = page.locator('.compare-matrix tbody tr').filter({ has: page.locator('.compare-package-identity strong').filter({ hasText: /^Tangki$/ }) });
  await row.getByRole('button', { name: 'Pilih rencana ini', exact: false }).click();
  const chosen = await checkpoint(page, '06-human-selected-tank');
  expect(chosen.selectedPlan!.definition.components.map(c => c.id)).toEqual(['tank']);
  expect(fieldDecisionReadiness(chosen, 'r50').selected.status).toBe('current');
  const frozenChoice = structuredClone(chosen.selectedPlan!.definition);

  await nav(page, 'Hujan & kondisi awal');
  await page.getByLabel('Kedalaman hujan', { exact: true }).fill('70');
  await expect(page.locator('.rain-pending-note')).toContainText('50 mm');
  const pending = await checkpoint(page, '07-unapplied-rain-does-not-change-data');
  expect(readInput(pending, pending.scenarios.find(s => s.id === 'r50')!.rainfall).text).toBe('50');
  await page.getByRole('button', { name: 'Terapkan hujan & hitung ulang', exact: true }).click();
  const rainy = await checkpoint(page, '08-rain-applied-selection-stale');
  expect(fieldDecisionReadiness(rainy, 'r50').selected.status).toBe('stale');
  expect(rainy.selectedPlan!.definition).toEqual(frozenChoice);

  await nav(page, 'Intervensi'); await openTreatment(page, 'Tangki atap');
  await composer.getByRole('button', { name: '2 Kapasitas', exact: true }).click();
  await composer.locator('[name=capacity]').fill('');
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  const unknown = await checkpoint(page, '09-unknown-capacity-draft');
  expect(capacity(unknown, 'tank')).toBe('');
  expect(fieldDecisionReadiness(unknown, 'r50').activePackage.calculationReady).toBe(false);
  await composer.locator('[name=capacity]').fill('0');
  await composer.locator('[name=capacityBasis]').selectOption('user-entered');
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  const zero = await checkpoint(page, '10-explicit-zero-storage');
  expect(capacity(zero, 'tank')).toBe('0');
  expect(fieldDecisionReadiness(zero, 'r50').activePackage.calculationReady).toBe(true);
  expect(zero.selectedPlan!.definition).toEqual(frozenChoice);
  await page.screenshot({ path: `${out}/10-explicit-zero-storage.png`, fullPage: true });

  await page.reload();
  if (await page.locator('.local-projects > summary').isVisible()) {
    await page.locator('.local-projects > summary').click();
    await page.locator('.local-projects button').filter({ hasText: p.name }).first().click();
  }
  const reloaded = await checkpoint(page, '11-reload-persists-mutations');
  expect(capacity(reloaded, 'tank')).toBe('0');
  expect(reloaded.selectedPlan!.definition).toEqual(frozenChoice);
  expect(fieldDecisionReadiness(reloaded, 'r50').selected.status).toBe('stale');
  const dialog = await report(page);
  await expect(dialog.getByLabel('Paket dalam laporan', { exact: true })).toHaveValue('selected');
  const pdf = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Unduh PDF', exact: true }).click()]).then(v => v[0]);
  await pdf.saveAs(`${out}/12-stale-human-choice-summary.pdf`);
  expect((await readFile(`${out}/12-stale-human-choice-summary.pdf`)).subarray(0, 5).toString()).toBe('%PDF-');
  await expect(dialog.locator('.report-export-error')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();

  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  const importedPage = await context.newPage();
  importedPage.on('pageerror', e => runtime.push({ kind: 'import-pageerror', message: e.message }));
  await importedPage.goto(new URL('/tirta.html', page.url()).href);
  const freshUpload = importedPage.getByLabel('Buka berkas cadangan'); await revealAncestors(freshUpload);
  await freshUpload.setInputFiles(`${out}/11-reload-persists-mutations.tirta.json`);
  await expect(importedPage.locator('.view-studio')).toBeVisible();
  const imported = await checkpoint(importedPage, '13-backup-import-roundtrip');
  expect(imported.components).toEqual(reloaded.components);
  expect(imported.parameters).toEqual(reloaded.parameters);
  expect(imported.science).toEqual(reloaded.science);
  expect(imported.selectedPlan!.definition).toEqual(frozenChoice);
  expect(fieldDecisionReadiness(imported, 'r50').selected.status).toBe('stale');
  await writeFile(`${out}/runtime-errors.json`, JSON.stringify(runtime, null, 2));
  await importedPage.screenshot({ path: `${out}/13-backup-import-roundtrip.png`, fullPage: true });
  await context.close(); expect(runtime).toEqual([]);
});
