import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/production.html');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
}
async function openInterventions(page: Page) {
  const mobile = page.getByLabel('Ruang kerja', { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: 'Intervensi' });
  else await page.getByRole('button', { name: 'Intervensi', exact: true }).click();
}

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

test('known but incompatible area is explained and does not trap guided navigation', async ({ page }) => {
  await openDemo(page);
  await openInterventions(page);
  await page.getByRole('button', { name: 'Tambahkan Biopori', exact: true }).click();
  const composer = page.locator('.treatment-composer');
  const start = composer.getByRole('button', { name: 'Langsung mulai', exact: true });
  if (await start.isVisible()) await start.click();

  await composer.getByRole('button', { name: 'Semua kebutuhan', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Semua kebutuhan penanganan' });
  await dialog.locator('.need-row').filter({ hasText: 'Ruang pemasangan' }).click();
  await composer.locator('[name=area]').fill('999');
  await page.waitForTimeout(80);

  await composer.getByRole('button', { name: 'Semua kebutuhan', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Semua kebutuhan penanganan' });
  const areaRow = dialog.locator('.need-row').filter({ hasText: 'Ruang pemasangan' });
  await expect(areaRow).toHaveAttribute('data-status', 'invalid');
  await expect(areaRow).toContainText(/melebihi|kurangi|lokasi/i);
  await dialog.getByRole('button', { name: 'Tutup', exact: true }).click();

  const before = await composer.locator('.guided-task-surface h3').innerText();
  expect(before).toContain('Berapa luas yang dipakai');
  await composer.getByRole('button', { name: 'Selanjutnya', exact: true }).click();
  await expect(composer.locator('.guided-task-surface h3')).not.toContainText('Berapa luas yang dipakai');
  await expect(composer.locator('.guided-feedback')).toContainText(/tetap dapat melanjutkan|belum dianggap siap/i);
});


test('a genuinely missing required fact still blocks normal Next until explicitly deferred', async ({ page }) => {
  await openDemo(page);
  await openInterventions(page);
  await page.getByRole('button', { name: 'Tambahkan Biopori', exact: true }).click();
  const composer = page.locator('.treatment-composer');
  const start = composer.getByRole('button', { name: 'Langsung mulai', exact: true });
  if (await start.isVisible()) await start.click();
  const heading = composer.locator('.guided-task-surface h3');
  const before = await heading.innerText();
  await composer.getByRole('button', { name: 'Selanjutnya', exact: true }).click();
  await expect(heading).toHaveText(before);
  await expect(composer.locator('.guided-feedback')).toContainText(/diperlukan/i);
});
