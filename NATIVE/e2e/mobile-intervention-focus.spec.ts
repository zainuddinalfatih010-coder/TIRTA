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

for (const width of [390, 412]) {
  test(`mobile ${width}px keeps rain pills whole and foregrounds the active intervention question`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openDemo(page);
    await openInterventions(page);
    await page.getByRole('button', { name: 'Tambahkan Rain garden', exact: true }).click();
    await page.waitForTimeout(500);

    const question = page.locator('.guided-task-surface h3');
    await expect(question).toBeVisible();
    await expect.poll(async () => (await question.boundingBox())?.y ?? 9999).toBeLessThan(300);
    await expect.poll(async () => (await question.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(65);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const rail = page.locator('.intervention-rain-selection .scenario-switch');
    const activeRain = rail.locator('button[aria-pressed=true]').first();
    const railBox = await rail.boundingBox();
    const chipBox = await activeRain.boundingBox();
    expect(railBox).not.toBeNull(); expect(chipBox).not.toBeNull();
    expect(chipBox!.y).toBeGreaterThanOrEqual(railBox!.y + 2);
    expect(chipBox!.y + chipBox!.height).toBeLessThanOrEqual(railBox!.y + railBox!.height - 2);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const back = page.getByRole('button', { name: 'Kembali ke pertanyaan', exact: true });
    await expect(back).toBeVisible();
    await back.click();
    await expect.poll(async () => (await question.boundingBox())?.y ?? 9999).toBeLessThan(300);
  });
}

test('mobile keeps Navigator reachable and its header/task surface fully inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await page.waitForTimeout(4800);
  const trigger = page.getByRole('button', { name: 'Navigator TIRTA', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Navigator TIRTA', exact: true });
  await expect(dialog).toBeVisible();
  const shell = page.locator('.navigator-modal-shell');
  const header = shell.locator('.navigator-header');
  const task = shell.locator('.navigator-task-surface');
  const close = page.getByRole('button', { name: 'Tutup Navigator', exact: true });
  for (const locator of [shell, header, task, close]) await expect(locator).toBeVisible();
  const [shellBox, headerBox, taskBox, closeBox] = await Promise.all([shell.boundingBox(), header.boundingBox(), task.boundingBox(), close.boundingBox()]);
  for (const box of [shellBox, headerBox, taskBox, closeBox]) {
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }
  expect(headerBox!.y).toBeGreaterThanOrEqual(shellBox!.y);
  expect(taskBox!.y).toBeGreaterThanOrEqual(headerBox!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('mobile guided navigation keeps previous and next on one row', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await openDemo(page);
  await openInterventions(page);
  await page.getByRole('button', { name:'Tambahkan Rain garden', exact:true }).click();
  await page.getByRole('button', { name:'Langsung mulai', exact:true }).click();
  await page.waitForTimeout(60);
  const boxes = await page.locator('.composer-command-main').evaluate(el => {
    const back = el.querySelector<HTMLElement>('.btn-back')!.getBoundingClientRect();
    const next = el.querySelector<HTMLElement>('.btn-primary')!.getBoundingClientRect();
    return { back:{ x:back.x, y:back.y, width:back.width }, next:{ x:next.x, y:next.y, width:next.width } };
  });
  expect(Math.abs(boxes.back.y - boxes.next.y)).toBeLessThanOrEqual(1);
  expect(boxes.back.x + boxes.back.width).toBeLessThan(boxes.next.x);
  expect(boxes.next.x + boxes.next.width).toBeLessThanOrEqual(390 - 10);
});
