import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { projectV2Schema, type ProjectV2 } from '../src/domain/projectV2';
import { containsPoint } from '../src/domain/geometry';

const out = 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/interactions';
async function open(page: Page, project: ProjectV2) {
  await page.goto('/tirta.html');
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'synthetic-interactions.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(project)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Tutup pemberitahuan' }); if (await notice.isVisible()) await notice.click();
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  await expect(page.locator('.view-interventions')).toBeVisible();
}
function errors(page: Page) {
  const observed: string[] = [];
  page.on('pageerror', error => observed.push(error.message));
  page.on('console', message => { if (message.type() === 'error') observed.push(message.text()); });
  return observed;
}
async function backup(page: Page, name: string) {
  await page.getByRole('button', { name: 'Proyek', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh cadangan proyek', exact: true }).click()]);
  await mkdir(out, { recursive: true }); await download.saveAs(`${out}/${name}.tirta.json`);
  return projectV2Schema.parse((JSON.parse(await readFile((await download.path())!, 'utf8')) as { project: unknown }).project);
}
const canvas = (page: Page) => page.locator('.intervention-preview .parcel-svg');
async function zoneTarget(page: Page, name: string) {
  const svg = canvas(page); await svg.scrollIntoViewIfNeeded();
  const whole = (await svg.boundingBox())!, zone = (await svg.getByRole('button', { name: `Pilih zona ${name}`, exact: true }).boundingBox())!;
  return { x: zone.x + zone.width / 2 - whole.x, y: zone.y + zone.height / 2 - whole.y };
}
async function nativeDrop(page: Page, palette: Locator, zoneName: string) {
  await expect(palette).toHaveAttribute('draggable', 'true');
  const position = await zoneTarget(page, zoneName);
  await palette.dragTo(canvas(page), { targetPosition: position });
}
async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}
function baselineInputs(project: ProjectV2) {
  const ids = new Set([...project.zones.flatMap(zone => [zone.area.id, zone.coefficient.id]), ...project.scenarios.map(scenario => scenario.rainfall.id)]);
  return { zones: project.zones, scenarios: project.scenarios, parameters: project.parameters.filter(parameter => ids.has(parameter.id)) };
}

test('native palette drop uses four compact ghosts and creates declared UNKNOWN drafts without changing baseline inputs', async ({ page }) => {
  const observed = errors(page);
  await page.addInitScript(() => {
    const original = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (element, x, y) {
      const state = window as unknown as { nativeGhosts?: { tag: string; width: number; height: number; text: string | null; x: number; y: number }[] };
      state.nativeGhosts ??= [];
      state.nativeGhosts.push({ tag: element.tagName, width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height, text: element.textContent, x, y });
      return original.call(this, element, x, y);
    };
  });
  const fixture = setActiveComponents(demoProject(true), []);
  await open(page, fixture);
  await expect(page.locator('.intervention-palette button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Tambahkan Permukaan berpori', exact: true })).toHaveCount(0);
  for (const [method, zone] of [['Tangki', 'Gedung belajar'], ['Sumur / area resapan', 'Tanah timur'], ['Rain garden', 'Halaman kegiatan'], ['Biopori', 'Tanah timur']]) {
    await nativeDrop(page, page.getByRole('button', { name: `Tambahkan ${method}`, exact: true }), zone!);
  }
  await expect(page.locator('.intervention-instance-list .instance-select')).toHaveCount(4);
  const ghosts = await page.evaluate(() => (window as unknown as { nativeGhosts: { tag: string; width: number; height: number; text: string | null; x: number; y: number }[] }).nativeGhosts);
  expect(ghosts).toHaveLength(4);
  for (const ghost of ghosts) {
    expect(ghost.tag).toBe('CANVAS'); expect(ghost.text).toBe('');
    expect(Math.max(ghost.width, ghost.height)).toBeLessThanOrEqual(96);
    expect(ghost.x).toBeGreaterThan(0); expect(ghost.y).toBeGreaterThan(0);
  }
  await shot(page, 'native-palette-1440');
  const saved = await backup(page, 'native-palette');
  const added = saved.components.filter(component => !fixture.components.some(original => original.id === component.id));
  expect(added).toHaveLength(4); expect(baselineInputs(saved)).toEqual(baselineInputs(fixture));
  for (const component of added) {
    expect(component.enabled).toBe(true); expect(component.targets).toEqual([]);
    expect(component.placement?.context).toBe('schematic');
    expect(containsPoint(saved.parcel!.polygon, component.placement!.point)).toBe(true);
    for (const ref of [component.totalCost, component.occupiedArea]) expect(saved.parameters.find(parameter => parameter.id === ref.id)?.value).toBeNull();
    const performance = component.performanceByScenario.r50!;
    const capacity = 'availableStorage' in performance ? performance.availableStorage : 'infiltrationCapacity' in performance ? performance.infiltrationCapacity : performance.additionalInfiltrationCapacity;
    expect(saved.parameters.find(parameter => parameter.id === capacity.id)?.value).toBeNull();
  }
  const biopori = added.find(component => component.family === 'infiltration' && component.infiltrationType === 'biopori')!;
  expect(biopori.treatment?.installationZoneId).toBe('z2');
  await writeFile(`${out}/native-palette-runtime.json`, JSON.stringify({ ghosts, errors: observed }, null, 2));
  expect(observed).toEqual([]);
});

test('instance pointer movement changes only schematic placement; blank click and Escape clear the selected editor', async ({ page }) => {
  const observed = errors(page);
  await open(page, setActiveComponents(demoProject(true), ['tank']));
  const before = await backup(page, 'pointer-before');
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  const marker = canvas(page).locator('[data-intervention-marker=tank]');
  await marker.scrollIntoViewIfNeeded();
  const initial = await marker.getAttribute('transform'), box = (await marker.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 18, { steps: 8 }); await page.mouse.up();
  await expect(marker).not.toHaveAttribute('transform', initial!);
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await canvas(page).click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.active-intervention-editor .inspector-empty')).toContainText('Pilih satu intervensi');
  await marker.click(); await expect(marker).toHaveAttribute('aria-pressed', 'true');
  await marker.focus(); await page.keyboard.press('Escape');
  await expect(marker).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.active-intervention-editor .inspector-empty')).toBeVisible();
  await shot(page, 'pointer-deselect-1440');
  const after = await backup(page, 'pointer-after');
  const original = before.components.find(component => component.id === 'tank')!, moved = after.components.find(component => component.id === 'tank')!;
  expect(moved.placement).not.toEqual(original.placement);
  expect(moved.revision).toBeGreaterThan(original.revision);
  expect({ ...moved, placement: null, revision: 0 }).toEqual({ ...original, placement: null, revision: 0 });
  expect(after.parameters).toEqual(before.parameters); expect(after.science).toEqual(before.science);
  expect(baselineInputs(after)).toEqual(baselineInputs(before)); expect(observed).toEqual([]);
});

test('390 keyboard placement needs no drag and Biopori rejects a roof canvas receiver without losing its draft', async ({ page }) => {
  const observed = errors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = setActiveComponents(demoProject(true), []); await open(page, fixture);
  const add = page.getByRole('button', { name: 'Tambahkan Tangki', exact: true });
  await add.focus(); await page.keyboard.press('Enter');
  const editor = page.locator('.treatment-composer');
  await expect(editor.locator('.role-choice').first()).toBeFocused();
  await expect(page.locator('.placement-cue')).toHaveCount(0);
  await page.locator('[data-component=tank-2] .instance-menu-trigger').click();
  const place = page.getByRole('button', { name: 'Letakkan di persil', exact: true });
  await place.focus(); await page.keyboard.press('Enter');
  const center = page.getByRole('button', { name: 'Letakkan di tengah persil', exact: true });
  await center.focus(); await page.keyboard.press('Enter');
  await expect(canvas(page).locator('[data-intervention-marker=tank-2]')).toBeVisible();
  await page.getByRole('button', { name: 'Tambahkan Biopori', exact: true }).click();
  await editor.getByRole('button', { name: 'Belum dipilih', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Pilih lokasi penerapan', exact: true });
  await expect(picker).toContainText('dapat dipasang pada semua jenis permukaan kecuali Atap');
  await expect(picker.locator('.role-zone-list button')).toHaveCount(4);
  await expect(picker.locator('.role-zone-list')).toContainText('Tanah timur');
  await picker.getByRole('button', { name: 'Pilih pada persil', exact: true }).click();
  await canvas(page).getByRole('button', { name: 'Pilih zona Gedung belajar', exact: true }).click();
  await expect(page.locator('.notice')).toContainText('Biopori tidak dapat dipasang pada Atap');
  await expect(page.locator('.selection-role-cue')).toContainText('Pilih lokasi penerapan');
  await canvas(page).getByRole('button', { name: 'Pilih zona Tanah timur', exact: true }).click();
  await expect(page.locator('.selection-role-cue')).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Tanah timur', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Tanah timur', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await shot(page, 'keyboard-biopori-390');
  const saved = await backup(page, 'keyboard-biopori');
  const tank = saved.components.find(component => component.id === 'tank-2')!, biopori = saved.components.find(component => component.id === 'soak-2')!;
  expect(tank.placement?.context).toBe('schematic'); expect(tank.targets).toEqual([]);
  expect(biopori.treatment?.installationZoneId).toBe('z2'); expect(biopori.targets).toEqual([]);
  expect(saved.parameters.find(parameter => parameter.id === biopori.totalCost.id)?.value).toBeNull();
  expect(baselineInputs(saved)).toEqual(baselineInputs(fixture)); expect(observed).toEqual([]);
});
