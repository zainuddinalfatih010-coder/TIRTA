import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { currentDemoProject } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import type { ProjectV2 } from '../src/domain/projectV2';
import { containsPoint } from '../src/domain/geometry';

const audit = 'E:/CodexStore/home/audits/tirta-biopori-non-roof-2026-10-12';
const stage = process.env.TIRTA_BIOPORI_LIVE_URL ? 'live' : 'local';
const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await mkdir(`${audit}/${stage}`, { recursive: true });
  const list: string[] = []; issues.set(page, list);
  page.on('pageerror', error => list.push(error.message));
  page.on('console', message => { if (message.type() === 'error') list.push(message.text()); });
});
test.afterEach(({ page }) => expect(issues.get(page)).toEqual([]));

async function open(page: Page) {
  const project = currentDemoProject(true);
  project.components = []; project.optionGroups = []; project.selectedPlan = null;
  project.science!.connections = []; project.science!.interventions = {};
  expect(project.zones.map(zone => zone.surface).sort()).toEqual(['paved', 'porous', 'roof', 'soil', 'vegetation']);
  await page.goto('/tirta.html');
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'biopori-surfaces.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(project)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  const close = page.getByRole('button', { name: 'Tutup Navigator', exact: true });
  if (await close.isVisible()) await close.click();
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  await page.getByRole('button', { name: 'Tambahkan Biopori', exact: true }).click();
  await expect(page.locator('.treatment-heading h2')).toHaveText('Biopori');
  return project;
}
async function field(page: Page, label: string) {
  await page.getByRole('button', { name: 'Lihat semua kebutuhan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Semua kebutuhan penanganan', exact: true });
  await dialog.locator('.need-row').filter({ has: page.locator('.need-row-label', { hasText: label }) }).click();
}
async function roofSource(page: Page) {
  await field(page, 'Sumber air');
  await page.locator('[data-role-choice=source]').click();
  await page.getByRole('dialog', { name: 'Pilih sumber limpasan', exact: true }).getByRole('button', { name: /^Gedung belajar/ }).click();
  await expect(page.locator('.treatment-source-chips')).toContainText('Gedung belajar');
}
async function picker(page: Page) {
  await field(page, 'Lokasi pemasangan');
  await page.locator('[data-role-choice=installation]').click();
  const dialog = page.getByRole('dialog', { name: 'Pilih lokasi penerapan', exact: true });
  await expect(dialog.locator('.role-zone-list button')).toHaveCount(4);
  for (const name of ['Halaman kegiatan', 'Tanah timur', 'Taman', 'Paving berpori']) await expect(dialog.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Gedung belajar/ })).toHaveCount(0);
  await expect(dialog).not.toContainText('Biopori hanya');
  return dialog;
}
async function saveAndActivate(page: Page) {
  for (const [label, name, value] of [['Kapasitas', 'capacity', '0.25'], ['Biaya', 'cost', '20000'], ['Ruang pemasangan', 'area', '0.2']] as const) {
    await field(page, label);
    const input = page.locator(`.treatment-composer [name=${name}]`);
    await expect(input).toHaveValue('');
    await input.fill(value);
  }
  await page.getByRole('button', { name: 'Selanjutnya', exact: true }).click();
  await page.getByRole('button', { name: /^(Tambahkan ke rencana|Simpan penanganan)$/ }).click();
  await expect(page.locator('.intervention-preview [data-intervention-marker]')).toBeVisible();
}
async function backup(page: Page, name: string): Promise<ProjectV2> {
  const menu = page.locator('.project-actions');
  if (!await menu.getAttribute('open')) await menu.locator('summary').click();
  await menu.getByRole('button', { name: 'Laporan proyek', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const [file] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Cadangan proyek', exact: true }).click()]);
  const path = `${audit}/${stage}/${name}.tirta.json`; await file.saveAs(path);
  await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();
  return JSON.parse(await readFile(path, 'utf8')).project;
}

for (const [surface, id, name] of [['paved', 'z1', 'Halaman kegiatan'], ['vegetation', 'z3', 'Taman'], ['porous', 'z4', 'Paving berpori'], ['soil', 'z2', 'Tanah timur']] as const) {
  test(`Biopori accepts ${surface} in picker and canvas, renders marker, and keeps roof runoff independent`, async ({ page }) => {
    const initial = await open(page); await roofSource(page);
    const dialog = await picker(page); await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(page.locator('[data-role-choice=installation]')).toHaveText(name);
    const canvasPicker = await picker(page); await canvasPicker.getByRole('button', { name: 'Pilih pada persil', exact: true }).click();
    await page.locator('.intervention-preview').getByRole('button', { name: `Pilih zona ${name}`, exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.selection-role-cue')).toHaveCount(0);
    await expect(page.locator('[data-role-choice=installation]')).toHaveText(name);
    await saveAndActivate(page);
    const marker = page.locator('.intervention-preview [data-intervention-marker]');
    await expect(marker).toHaveAttribute('aria-label', new RegExp(`lokasi ${name}; sumber Gedung belajar`));
    const previous = await marker.getAttribute('transform');
    const destination = await page.locator(`.intervention-preview [data-testid=zone-${id}]`).evaluate(element => {
      const polygon = element as SVGGeometryElement, box = polygon.getBBox();
      for (const x of [.35, .65]) for (const y of [.35, .65]) {
        const point = new DOMPoint(box.x + box.width * x, box.y + box.height * y);
        if (polygon.isPointInFill(point)) { const screen = point.matrixTransform(polygon.getScreenCTM()!); return { x: screen.x, y: screen.y }; }
      }
      throw new Error('No usable point in installation polygon');
    });
    const bounds = await marker.boundingBox(); expect(bounds).not.toBeNull();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2); await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 8 }); await page.mouse.up();
    await expect(marker).not.toHaveAttribute('transform', previous!);
    const transform = await marker.getAttribute('transform');
    await marker.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.treatment-composer')).toBeVisible();
    await page.screenshot({ path: `${audit}/${stage}/${surface}-marker.png`, fullPage: true });
    const saved = await backup(page, surface), component = saved.components.find(c => c.family === 'infiltration' && c.infiltrationType === 'biopori')!;
    expect(component.treatment?.installationZoneId).toBe(id); expect(component.targets).toEqual(['z0']);
    expect(containsPoint(saved.zones.find(zone => zone.id === id)!.polygon, component.placement!.point)).toBe(true);
    expect(saved.zones).toEqual(initial.zones); expect(saved.scenarios).toEqual(initial.scenarios);
    expect(saved.science!.interventions[component.id]!.soilInfiltration.value).toBeNull();
    const performance = component.performanceByScenario.r50!; if (!('infiltrationCapacity' in performance)) throw new Error('Expected Biopori capacity');
    expect(saved.parameters.find(p => p.id === performance.infiltrationCapacity.id)!.value).toBe(0.25);
    expect(transform).toMatch(/^translate\(/);
  });
}
test('roof canvas receiver is rejected without changing the source, installation or draft', async ({ page }) => {
  await open(page); await roofSource(page);
  const dialog = await picker(page); await dialog.getByRole('button', { name: 'Pilih pada persil', exact: true }).click();
  await page.locator('.intervention-preview').getByRole('button', { name: 'Pilih zona Gedung belajar', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.notice')).toContainText('Biopori tidak dapat dipasang pada Atap');
  await expect(page.locator('.selection-role-cue')).toContainText('Pilih lokasi penerapan');
  await expect(page.locator('.intervention-preview [data-intervention-marker]')).toHaveCount(0);
  await page.locator('.intervention-preview').getByRole('button', { name: 'Pilih zona Halaman kegiatan', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-role-choice=installation]')).toHaveText('Halaman kegiatan');
  await expect(page.locator('.treatment-source-chips')).toHaveCount(1);
  await saveAndActivate(page);
  const saved = await backup(page, 'roof-rejected');
  const c = saved.components.find(c => c.family === 'infiltration' && c.infiltrationType === 'biopori')!;
  expect(c.targets).toEqual(['z0']); expect(c.treatment?.installationZoneId).toBe('z1');
});
