import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Muat contoh simulasi' }).click();
}
async function stage(page: Page, label: string) {
  await page.getByRole('navigation').getByRole('button', { name: new RegExp(label) }).click();
}

test('selection, independent coefficient, stale recalculation and actionable UNKNOWN', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => { if (e.type() === 'error') errors.push(e.text()); });
  await demo(page);
  await stage(page, 'Persil');
  await page.getByRole('button', { name: 'Pilih Taman sekolah', exact: true }).click();
  await expect(page.getByLabel('Nama zona', { exact: true })).toHaveValue('Taman sekolah');
  await expect(page.locator('.zone-row.active')).toContainText('Taman sekolah');
  await page.getByLabel('Jenis permukaan').selectOption('paved');
  await expect(page.getByLabel('Koefisien limpasan', { exact: true })).toHaveValue('0.2');
  await page.getByLabel('Koefisien limpasan', { exact: true }).fill('0.4');
  await page.getByRole('button', { name: 'Terapkan nilai' }).click();
  await stage(page, 'Hujan');
  await expect(page.getByText('Hasil perlu diperbarui', { exact: true })).toBeVisible();
  await expect(page.locator('.water-story')).toHaveCount(0);
  await page.getByRole('button', { name: 'Perbarui hasil' }).click();
  await expect(page.locator('.water-step.emphasis strong')).toContainText('41,4');
  await page.getByLabel('Kedalaman hujan', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Hitung kondisi awal' }).click();
  await expect(page.locator('.water-step.emphasis strong')).toContainText('66,24');
  await page.getByLabel('Kedalaman hujan', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Hitung kondisi awal' }).click();
  await expect(page.getByRole('alert')).toContainText('Data ini belum tersedia');
  await expect(page.locator('.scenario-list button').first()).toContainText('Belum diketahui');
  await expect(page.locator('.water-story')).toHaveCount(0);
  await page.getByRole('button', { name: 'Atur ulang contoh' }).click();
  await stage(page, 'Persil');
  await page.getByLabel('Koefisien limpasan', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Terapkan nilai' }).click();
  await stage(page, 'Hujan');
  await page.getByRole('button', { name: 'Hitung kondisi awal' }).click();
  await page.getByRole('alert').getByRole('button', { name: /Gedung utama/ }).click();
  await expect(page.getByLabel('Nama zona', { exact: true })).toHaveValue('Gedung utama');
  await expect(page.getByLabel('Koefisien limpasan', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});

test('empty project has no invented results and source dialog supports Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nama proyek', { exact: true }).fill('Uji proyek kosong');
  await page.getByRole('button', { name: 'Buat proyek kosong' }).click();
  await expect(page.getByRole('heading', { name: 'Persil Anda belum tergambar.' })).toBeVisible();
  await expect(page.locator('.water-story')).toHaveCount(0);
  await page.getByRole('button', { name: 'Jelajahi contoh terisi' }).click();
  await page.getByRole('button', { name: 'Catatan Asumsi', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Catatan Asumsi' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Catatan Asumsi', exact: true })).toBeFocused();
});

test('illustrative choices and rainfall comparison remain explicit and interactive', async ({ page }) => {
  await demo(page); await stage(page, 'Intervensi');
  await expect(page.getByText(/Ini belum hasil optimizer/)).toBeVisible();
  await page.locator('.option-list').getByRole('button', { name: /^Tangki Lebih/ }).click();
  await expect(page.locator('.before-after .water-text')).toContainText('31,4');
  await page.getByRole('button', { name: 'Bandingkan contoh', exact: true }).click();
  await page.getByRole('button', { name: '80 mm', exact: true }).click();
  await expect(page.locator('.comparison-table')).toContainText('43,04');
  await page.getByRole('button', { name: /Tangki \+ resapan/ }).click();
  await expect(page.locator('.comparison-detail')).toContainText('Infiltrasi 12 m³');
});

const viewports = [[1920,1080],[1707,862],[1536,864],[1440,900],[1366,768],[1280,800],[768,1024],[390,844],[360,800]] as const;
for (const [width,height] of viewports) {
  test(`five populated screens at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await demo(page);
    for (const label of ['Ringkasan','Persil','Hujan','Intervensi','Bandingkan']) {
      if (label === 'Ringkasan') await page.getByRole('button', { name: 'TIRTA — Ringkasan' }).click();
      else await stage(page, label);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const metrics = await page.evaluate(() => ({ width: window.innerWidth, document: document.documentElement.scrollWidth }));
      expect(metrics.width).toBe(width); expect(metrics.document).toBeLessThanOrEqual(width);
      if (label === 'Persil') {
        const box = await page.locator('.parcel-map').boundingBox();
        expect(box!.width).toBeGreaterThan(width < 700 ? 280 : 380);
        await page.getByRole('button', { name: 'Perbesar denah', exact: true }).click();
        await expect(page.getByLabel('Pembesaran denah')).toContainText('125%');
        await page.getByRole('button', { name: 'Tampilkan seluruh persil', exact: true }).click();
      }
      if (width === 1440 || width === 390) {
        await page.evaluate(() => window.scrollTo(0,0));
        await page.screenshot({ path: `evidence/${label.toLowerCase()}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('mobile sheet preserves selection and can collapse without trapping keyboard', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 }); await demo(page); await stage(page,'Persil');
  await page.getByLabel('Zona terpilih', { exact: true }).selectOption('vegetation');
  await page.locator('.sheet-toggle').click();
  await expect(page.getByLabel('Nama zona', { exact:true })).toHaveValue('Taman sekolah');
  await page.locator('.sheet-toggle').click();
  await page.locator('.sheet-toggle').click();
  await expect(page.locator('.inspector-body')).not.toBeVisible();
  await page.getByRole('button', { name: 'Catatan Asumsi', exact:true }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
});

test('accessibility baseline on all populated desktop screens and mobile Persil', async ({ page }) => {
  await demo(page);
  for (const label of ['Ringkasan','Persil','Hujan','Intervensi','Bandingkan']) {
    if (label !== 'Ringkasan') await stage(page,label);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(scan.violations, JSON.stringify(scan.violations.map((v) => ({ id:v.id, targets:v.nodes.map((n) => n.target) })))).toEqual([]);
  }
  await page.setViewportSize({width:390,height:844}); await stage(page,'Persil');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
