import { test, expect, type Page } from '@playwright/test';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import type { ProjectV2 } from '../src/domain/projectV2';

async function open(page: Page, p: ProjectV2) {
  await page.goto('/tirta.html');
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({ name: 'adversarial-synthetic.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(p)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  const dismiss = page.getByRole('button', { name: 'Tutup pemberitahuan' }); if (await dismiss.isVisible()) await dismiss.click();
}

test('explicit receiver selection updates context and creates a soil-only Biopori draft with no invented quantities', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, setActiveComponents(demoProject(true), []));
  await page.getByRole('button', { name: 'Tanya TIRTA', exact: true }).click();
  await expect(page.locator('#guidance-installation')).toHaveValue('');
  await page.getByRole('combobox', { name: 'Sumber air', exact: true }).selectOption('z0');
  await expect(page.locator('#assistant-zone')).toHaveValue('z0');
  await page.getByRole('combobox', { name: 'Lokasi pemasangan', exact: true }).selectOption('z2');
  await expect(page.locator('#assistant-zone')).toHaveValue('z2');
  await page.locator('[data-guidance=biopori]').getByRole('button', { name: 'Periksa bukti tanah lokasi', exact: true }).click();
  await expect(page.locator('.view-interventions')).toBeVisible();
  await expect(page.locator('.treatment-composer')).toContainText('Gedung belajar');
  await expect(page.locator('.treatment-composer')).toContainText('Tanah timur');
  await expect(page.locator('.treatment-composer input[name=capacity]')).toHaveValue('');
  await expect(page.locator('.treatment-composer input[name=area]')).toHaveValue('');
  await expect(page.locator('.treatment-composer input[name=cost]')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('imported inactive overflow remains visibly unrepaired instead of silently becoming UNKNOWN', async ({ page }) => {
  const p = demoProject(true);
  p.components.find(c => c.id === 'soak')!.enabled = false;
  p.science!.interventions.tank!.overflow = { kind: 'intervention', id: 'soak' };
  await open(page, p);
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  await page.locator('.instance-select').filter({ hasText: 'Tangki atap' }).click();
  const overflow = page.locator('.treatment-composer select[name=overflow]');
  await expect(overflow).toHaveValue('intervention:soak');
  await expect(overflow.locator('option:checked')).toHaveText('Tujuan sebelumnya perlu diperiksa');
  await expect(page.locator('.treatment-composer')).toContainText('hubungan lama tidak diganti otomatis');
  await page.locator('.treatment-stages button').nth(1).click();
  await expect(page.locator('.composer-readiness')).toContainText('Belum lengkap.');
  await expect(page.getByRole('region', { name: 'Dampak komposisi', exact: true })).toContainText('Belum dihitung');
});

test('moving an existing infiltration receiver withdraws old-site evidence in the actual composer', async ({ page }) => {
  const p = setActiveComponents(demoProject(true), ['soak']);
  p.components.find(c => c.id === 'soak')!.treatment = { installationZoneId: 'z2', sharedSourceMode: 'ledger', allocationNote: 'Synthetic isolated installation', catchmentReviewed: true };
  await open(page, p);
  await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
  const composer = page.locator('.treatment-composer');
  await expect(page.locator('.intervention-water-ledger')).toContainText('3 m³');
  await composer.getByRole('button', { name: 'Tanah timur', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pilih lokasi penerapan', exact: true }).getByRole('button', { name: /^Taman/ }).click();
  await composer.getByRole('button', { name: 'Simpan penanganan', exact: true }).click();
  await expect(composer.locator('.composer-readiness')).toContainText('Belum lengkap.');
  await expect(composer).toContainText('pada Taman');
  await composer.locator('.option-config-trigger').click();
  await page.getByRole('button', { name: 'Kondisi lokasi', exact: true }).click();
  await expect(page.getByLabel('Bukti infiltrasi tanah', { exact: true })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Kesesuaian terhadap kondisi air tanah', exact: true })).toHaveValue('unknown');
});
