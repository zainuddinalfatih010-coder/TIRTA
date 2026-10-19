import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/production.html');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
}

const routes = ['Studio Persil','Hujan & kondisi awal','Intervensi','Bandingkan','Rencana & Dampak'];

async function navigate(page: Page, label: string) {
  const picker = page.getByLabel('Ruang kerja', { exact: true });
  if (await picker.isVisible()) await picker.selectOption({ label });
  else await page.locator('.app-rail nav').getByRole('button', { name: label, exact: true, includeHidden: true }).click();
}

for (const width of [390, 412]) test(`mobile shell stays inside ${width}px across planning routes`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await openDemo(page);
  for (const label of routes) {
    await navigate(page, label);
    await page.waitForTimeout(120);
    await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`).toBe(true);
    const rail = await page.locator('.app-rail.is-project-workspace').boundingBox();
    expect(rail, `${label}: workflow rail missing`).not.toBeNull();
    expect(rail!.x).toBeGreaterThanOrEqual(0);
    expect(rail!.x + rail!.width).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole('button', { name: 'Navigator TIRTA', exact: true })).toBeVisible();
    for (const switcher of await page.locator('.scenario-switch:visible').all()) {
      const box = await switcher.boundingBox();
      if (!box) continue;
      for (const button of await switcher.locator('button:visible').all()) {
        const chip = await button.boundingBox(); if (!chip) continue;
        expect(chip.y, `${label}: scenario chip clipped at top`).toBeGreaterThanOrEqual(box.y - 0.5);
        expect(chip.y + chip.height, `${label}: scenario chip clipped at bottom`).toBeLessThanOrEqual(box.y + box.height + 0.5);
      }
    }
  }
});
