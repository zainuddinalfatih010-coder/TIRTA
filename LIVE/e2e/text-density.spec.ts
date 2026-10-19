import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const root = '.design/text-ux';

test('package choices stay visible, contextual reasons and help replace paragraph walls', async ({ page }) => {
  const errors: string[] = [];
  const modelRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/huggingface|hf\.co/.test(r.url())) modelRequests.push(r.url()); });
  await mkdir(root + '/screenshots', { recursive: true });
  await page.goto('/tirta');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
  await page.locator('.app-rail nav').getByRole('button', { name: 'Intervensi', exact: true }).click();

  const advisor = page.getByTestId('package-advisor');
  await expect(advisor.locator('.package-template')).toHaveCount(5);
  await expect(advisor.locator('details, select')).toHaveCount(0);
  await expect(page.getByTestId('local-planning-assistant')).toHaveCount(0);
  const before = JSON.parse(await readFile(root + '/baseline.json', 'utf8')) as { interventionText: string };
  const prior = before.interventionText.split('Paket untuk seluruh persil')[1]!.split('Mulai dari mana?')[0]!;
  const after = await advisor.innerText();
  const count = (s: string) => s.trim().split(/\s+/).length;
  expect(count(after)).toBeLessThan(count(prior) * 0.55);

  const states = [];
  for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [375, 812]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(advisor.getByRole('button', { name: 'Siapkan paket Tangki + Biopori', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    states.push({ width, height, advisorHeight: await advisor.evaluate(e => e.getBoundingClientRect().height) });
    await page.screenshot({ path: root + `/screenshots/interventions-${width}.png`, fullPage: true });

    const reason = advisor.getByRole('button', { name: 'Alasan paket Tangki + Biopori', exact: true });
    await reason.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Gedung belajar');
    await expect(dialog).toContainText('Biopori');
    await expect(dialog).toContainText('bukan siap bangun');
    await dialog.screenshot({ path: root + `/screenshots/reason-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(reason).toBeFocused();
  }

  await expect(page.getByRole('button', { name: 'Tanya TIRTA', exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(modelRequests).toEqual([]);

  await writeFile(root + '/runtime.json', JSON.stringify({ packageWords: { before: count(prior), after: count(after) }, states, errors, modelRequests }, null, 2));
  expect(errors).toEqual([]);
});
