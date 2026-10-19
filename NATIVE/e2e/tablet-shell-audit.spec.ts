import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/production.html');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
}

async function navigate(page: Page, name: string) {
  const mobile = page.getByLabel('Ruang kerja', { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else await page.locator('.app-rail nav').getByRole('button', { name, exact: true, includeHidden: true }).click();
}

const sizes = [
  { name: 'iPad mini portrait', width: 768, height: 1024 },
  { name: 'iPad Air portrait', width: 820, height: 1180 },
  { name: 'iPad Pro portrait', width: 1024, height: 1366 },
  { name: 'iPad mini landscape', width: 1024, height: 768 },
  { name: 'iPad Air landscape', width: 1180, height: 820 },
];

for (const size of sizes) test(`${size.name} uses compact tablet shell`, async ({ page }) => {
  await page.setViewportSize({ width: size.width, height: size.height });
  await openDemo(page);
  const rail = page.locator('.app-rail.is-project-workspace');
  const railBox = await rail.boundingBox();
  expect(railBox).not.toBeNull();
  expect(railBox!.height).toBeLessThanOrEqual(112);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  const workflow = page.locator('.workflow-navigation');
  const flowBox = await workflow.boundingBox();
  expect(flowBox).not.toBeNull();
  expect(flowBox!.x).toBeGreaterThanOrEqual(0);
  expect(flowBox!.x + flowBox!.width).toBeLessThanOrEqual(size.width + 1);

  const hint = page.locator('.navigator-discovery-hint');
  if (await hint.isVisible()) {
    const hintBox = await hint.boundingBox();
    expect(hintBox).not.toBeNull();
    expect(hintBox!.y).toBeGreaterThanOrEqual(railBox!.y + railBox!.height - 1);
  }
});

test('tablet Studio Persil uses available width without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openDemo(page);
  const frame = page.locator('.view-studio .parcel-frame');
  const frameBox = await frame.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox!.width).toBeGreaterThan(680);
  expect(frameBox!.x + frameBox!.width).toBeLessThanOrEqual(820 - 16);
});

test('tablet Hujan fills the space below analysis instead of leaving a dead band', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openDemo(page);
  await navigate(page, 'Hujan & kondisi awal');
  const analysis = await page.locator('.rain-analysis').boundingBox();
  const parcel = await page.locator('.rain-parcel-context').boundingBox();
  expect(analysis).not.toBeNull();
  expect(parcel).not.toBeNull();
  expect(parcel!.x).toBeGreaterThanOrEqual(analysis!.x - 1);
  expect(parcel!.y - (analysis!.y + analysis!.height)).toBeLessThanOrEqual(24);
});


test('tablet landing fills the viewport down to the journey rail', async ({ page }) => {
  for (const [width, height] of [[768, 1024], [820, 1180], [1024, 1366]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/production.html');
    const journey = await page.locator('.landing-journey').boundingBox();
    const landing = await page.locator('.project-landing').boundingBox();
    expect(journey).not.toBeNull();
    expect(landing).not.toBeNull();
    expect(Math.abs(journey!.y + journey!.height - height)).toBeLessThanOrEqual(1);
    expect(Math.abs(landing!.y + landing!.height - height)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(10, 83, 117)');
  }
});
