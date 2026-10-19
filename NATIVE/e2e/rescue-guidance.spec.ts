import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { emptySurfaceContext } from '../src/domain/scientificContract';
import { packageCandidates } from '../src/assistant/assistance';
import { guidedCandidates } from '../src/assistant/recommendationGuide';
import { optimize } from '../src/domain/planningEngine';
import type { ProjectV2 } from '../src/domain/projectV2';

const evidence = process.env.TIRTA_GUIDANCE_EVIDENCE ?? 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/guidance';
async function open(page: Page, project: ProjectV2) {
  await page.goto('/tirta.html');
  const input = page.getByLabel('Buka berkas cadangan', { exact: true });
  for (const details of await input.locator('xpath=ancestor::details').all()) await details.evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await input.setInputFiles({ name: 'synthetic-guidance.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(project)) });
  await expect(page.locator('.view-studio')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Tutup pemberitahuan' });
  if (await notice.isVisible()) await notice.click();
  await page.getByRole('button', { name: 'Tanya TIRTA', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Panduan kondisi lokasi', exact: true })).toBeVisible();
}
async function ask(page: Page, question: string) {
  await page.getByLabel('Pertanyaan Anda', { exact: true }).fill(question);
  await page.getByRole('button', { name: 'Kirim pertanyaan', exact: true }).click();
}

test('local reviewed answers and object context work offline without any model/status request', async ({ page, context }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (/tirta-ai|\/analysis|huggingface|wllama|\.gguf|embedding/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await open(page, demoProject(true));
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'studio');
  await expect(page.locator('.thinking-orb,.assistant-quota,.assistant-mode-picker')).toHaveCount(0);
  await context.setOffline(true);
  await ask(page, 'Dari mana angka limpasan?');
  await expect(page.locator('.assistant-answer').last()).toContainText('6,27 m³');
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'rain');
  await ask(page, 'Bagaimana jika kondisi proyek berbeda?');
  await expect(page.locator('.assistant-answer').last()).toContainText('belum ada dalam panduan lokal');
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'rain');
  await ask(page, 'Bagaimana tangki dikosongkan?');
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'interventions');
  await expect(page.locator('#assistant-intervention')).toHaveValue('tank');
  await page.getByRole('button', { name: 'Kembali ke konteks langkah', exact: true }).click();
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'studio');
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('location changes explicit eligibility questions and proposal-core permeable stays explorable on paved zones', async ({ page }) => {
  const p = setActiveComponents(demoProject(true), []);
  await open(page, p);
  await page.getByRole('combobox', { name: 'Sumber air', exact: true }).selectOption('z0');
  await expect(page.locator('[data-guidance=storage]')).toHaveAttribute('data-status', 'needs-data');
  await expect(page.locator('[data-guidance=storage]')).toContainText('bagian atap');
  await page.getByRole('combobox', { name: 'Lokasi pemasangan', exact: true }).selectOption('z0');
  await expect(page.locator('[data-guidance=biopori]')).toHaveAttribute('data-status', 'conflict');
  await page.getByRole('combobox', { name: 'Lokasi pemasangan', exact: true }).selectOption('z2');
  await expect(page.locator('[data-guidance=biopori]')).toHaveAttribute('data-status', 'needs-data');
  await expect(page.locator('[data-guidance=biopori]')).toContainText('Bukti infiltrasi lokasi belum tersedia');
  await page.getByRole('combobox', { name: 'Sumber air', exact: true }).selectOption('z1');
  await expect(page.locator('[data-guidance=permeable]')).toHaveAttribute('data-status', 'eligible');
  await expect(page.locator('[data-guidance=permeable]')).toContainText('Beton/Aspal');
  await page.locator('[data-guidance=biopori]').getByRole('button', { name: 'Periksa bukti tanah lokasi', exact: true }).click();
  await expect(page.locator('.view-interventions')).toBeVisible();
  const controlled = setActiveComponents(demoProject(true), []);
  controlled.science!.surfaces.z0 = emptySurfaceContext();
  controlled.science!.surfaces.z0.roof.outlet = 'gutter-downpipe';
  await open(page, controlled);
  await page.getByRole('combobox', { name: 'Sumber air', exact: true }).selectOption('z0');
  await expect(page.locator('[data-guidance=storage]')).toHaveAttribute('data-status', 'eligible');
  await expect(page.locator('[data-guidance=storage]')).toContainText('ukuran nominal bukan otomatis ruang kosong');
  await expect(page.locator('[data-guidance=storage]')).not.toContainText('Dapat dihitung pada hujan yang dipilih');
});

test('explicit priority retains every tied canonical package, review acknowledgment Apply Undo and save/reload', async ({ page }) => {
  const p = setActiveComponents(demoProject(true), ['tank', 'soak', 'garden']);
  const search = optimize(p, 'r50'); if (!search.ok) throw new Error('Synthetic fixture invalid');
  const candidates = packageCandidates(p, search.value.alternatives, 'r50');
  expect(candidates.length).toBeGreaterThan(0);
  await open(page, p);
  await page.getByRole('button', { name: 'Pilih prioritas & bandingkan paket', exact: true }).click();
  await expect(page.locator('#assistant-priority')).toHaveValue('');
  await expect(page.locator('#assistant-package')).toHaveValue('');
  for (const priority of ['cost', 'area', 'residual'] as const) {
    await page.getByLabel('Prioritas rekomendasi', { exact: true }).selectOption(priority);
    await expect(page.locator('#assistant-package')).toHaveValue('');
    const ties = guidedCandidates(p, candidates, 'r50', priority);
    await expect(page.locator('.assistant-priority-options button')).toHaveCount(ties.length);
    expect(await page.locator('.assistant-priority-options button').count()).toBeGreaterThan(0);
  }
  await page.locator('.assistant-priority-options button').first().click();
  await page.getByRole('button', { name: 'Tinjau & terapkan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tinjau sebelum menerapkan' });
  await expect(dialog.getByRole('button', { name: 'Terapkan sebagai rencana pilihan', exact: true })).toBeDisabled();
  await dialog.getByLabel('Saya sudah meninjau paket dan kondisi penerapannya.').check();
  await dialog.getByRole('button', { name: 'Terapkan sebagai rencana pilihan', exact: true }).click();
  await expect(page.locator('.assistant-applied')).toContainText('Paket dipilih');
  await page.getByRole('button', { name: 'Batalkan pilihan', exact: true }).click();
  await expect(page.locator('.assistant-applied')).toContainText('dibatalkan');
  await page.getByRole('button', { name: 'Tinjau & terapkan', exact: true }).click();
  await page.getByLabel('Saya sudah meninjau paket dan kondisi penerapannya.').check();
  await page.getByRole('button', { name: 'Terapkan sebagai rencana pilihan', exact: true }).click();
  await page.locator('.project-actions > summary').click();
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.locator('.local-save-indicator')).toHaveAttribute('aria-label', 'Tersimpan lokal');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tanya TIRTA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Proyek', exact: true }).click();
  await page.locator('.local-projects > summary').click();
  await page.locator('.local-projects').getByRole('button', { name: /^Sekolah Taman Sari/ }).click();
  await page.getByRole('button', { name: 'Rencana & Dampak', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rencana pilihan Anda', exact: true })).toBeVisible();
});

test('a canonical input update makes an open acknowledged preview stale before apply', async ({ page }) => {
  await open(page, setActiveComponents(demoProject(true), ['tank', 'soak', 'garden']));
  await page.getByRole('button', { name: 'Pilih prioritas & bandingkan paket', exact: true }).click();
  await page.getByLabel('Prioritas rekomendasi', { exact: true }).selectOption('residual');
  await page.locator('.assistant-priority-options button').first().click();
  await page.getByRole('button', { name: 'Tinjau & terapkan', exact: true }).click();
  await page.getByLabel('Saya sudah meninjau paket dan kondisi penerapannya.').check();
  const apply = page.getByRole('button', { name: 'Terapkan sebagai rencana pilihan', exact: true });
  await expect(apply).toBeEnabled();
  // Adversarial update through the app's guidance event: add a new UNKNOWN draft while review is open.
  // This tests the rendered stale guard; forged and scenario-mismatch proposals have separate domain tests.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tirta-guidance-action', {
    detail: { field: 'soil', method: 'biopori', sourceId: 'z0', installationZoneId: 'z2' },
  })));
  await expect(page.getByRole('dialog', { name: 'Tinjau sebelum menerapkan' })).toContainText('Data atau hujan berubah');
  await expect(apply).toBeDisabled();
  await page.getByRole('dialog', { name: 'Tinjau sebelum menerapkan' }).getByRole('button', { name: 'Kembali', exact: true }).click();
  await expect(page.locator('.assistant-applied')).toHaveCount(0);
});

for (const width of [1920, 1440, 1366, 1280, 768, 390]) test(`site guide populated/error states, bounded layout and keyboard controls at ${width}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width, height: width === 1366 ? 650 : 844 });
  await open(page, setActiveComponents(demoProject(true), []));
  await page.getByRole('combobox', { name: 'Lokasi pemasangan', exact: true }).selectOption('z0');
  await expect(page.locator('[data-guidance=biopori]')).toHaveAttribute('data-status', 'conflict');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/site-guidance-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Pilih prioritas & bandingkan paket', exact: true }).click();
  await expect(page.locator('.assistant-package-empty')).toContainText('Belum ada paket');
  const priority = page.getByLabel('Prioritas rekomendasi', { exact: true });
  await priority.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(priority).not.toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
