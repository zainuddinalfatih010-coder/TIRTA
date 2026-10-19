import { test, expect, type Page } from '@playwright/test';

async function openDemoInterventions(page: Page) {
  await page.goto('/production.html');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
  const picker = page.getByLabel('Ruang kerja', { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label: 'Intervensi' });
  else await page.locator('.app-rail nav').getByRole('button', { name: 'Intervensi', exact: true, includeHidden: true }).click();
  await expect(page.locator('#workspace.view-interventions')).toBeVisible();
}

for (const size of [
  { name: 'desktop', width: 1660, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`Intervensi uses skyline only once on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await openDemoInterventions(page);
    const art = await page.locator('#workspace.view-interventions').evaluate((el) => ({
      base: getComputedStyle(el).backgroundImage,
      top: getComputedStyle(el, '::before').backgroundImage,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(art.top).toContain('water-landscape.webp');
    expect(art.base).not.toContain('water-landscape.webp');
    expect(art.base).toContain('closing-water.svg');
    expect(art.overflow).toBeLessThanOrEqual(1);
  });
}
