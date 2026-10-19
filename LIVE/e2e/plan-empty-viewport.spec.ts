import { test, expect, type Page } from '@playwright/test';

async function openEmptyPlan(page: Page) {
  await page.goto('/production.html');
  const demo = page.getByRole('button', { name: 'Buka Contoh', exact: true });
  if (await demo.isVisible()) await demo.click();
  const picker = page.getByLabel('Ruang kerja', { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: 'Rencana & Dampak' });
  else await page.locator('.app-rail nav').getByRole('button', { name: 'Rencana & Dampak', exact: true, includeHidden: true }).click();
  await expect(page.getByRole('heading', { name: 'Rencana belum dipilih', exact: true })).toBeVisible();
}

for (const size of [
  { name: 'desktop', width: 1748, height: 866 },
  { name: 'iPad Pro portrait', width: 1024, height: 1366 },
  { name: 'iPad Air portrait', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`empty Rencana fills the viewport on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openEmptyPlan(page);
    const workspace = page.locator('.workspace.view-impact');
    const box = await workspace.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeGreaterThanOrEqual(size.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
